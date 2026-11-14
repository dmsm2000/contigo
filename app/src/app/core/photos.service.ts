import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { compressImage } from './image-compress';
import {
  checkFile,
  coverOf,
  FileCheck,
  groupByTrip,
  Photo,
  photoPaths,
  PhotoRow,
  toPhoto,
} from './photos.logic';
import { SupabaseService } from './supabase.service';

const BUCKET = 'trip-photos';
/** Os links temporários duram 12 horas: chega para uma sessão inteira da app aberta. */
const URL_TTL_SECONDS = 12 * 60 * 60;
/** Renova-se um link quando falta menos de um minuto para ele caducar. */
const URL_MARGIN_MS = 60_000;
const PAGE = 1000;

/** Um erro de envio com o motivo, para o ecrã dizer o que correu mal. */
export class PhotoError extends Error {
  constructor(readonly reason: FileCheck | 'unsupported' | 'upload') {
    super(reason);
    this.name = 'PhotoError';
  }
}

interface SignedUrl {
  url: string;
  expiresAt: number;
}

/**
 * As fotos das viagens. Guardam-se versões otimizadas num bucket privado e mostram-se com links temporários.
 * Atualiza-se sozinha quando o outro junta ou apaga fotos.
 */
@Injectable({ providedIn: 'root' })
export class PhotosService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private channel: RealtimeChannel | null = null;

  readonly photos = signal<Photo[]>([]);
  private readonly warmed = new Set<string>();
  readonly loaded = signal(false);
  readonly loadFailed = signal(false);

  private readonly byTrip = computed(() => groupByTrip(this.photos()));
  /** Os links temporários já pedidos, pelo caminho do ficheiro. */
  private readonly urls = signal<ReadonlyMap<string, SignedUrl>>(new Map());

  constructor() {
    effect(() => {
      const userId = this.auth.userId();
      untracked(() => {
        if (userId) {
          void this.load();
          this.listen();
        } else {
          this.stopListening();
          this.photos.set([]);
          this.urls.set(new Map());
          this.loaded.set(false);
        }
      });
    });
  }

  /** As fotos de uma viagem, pela ordem em que foram juntadas. */
  photosOf(tripId: string): Photo[] {
    return this.byTrip().get(tripId) ?? [];
  }

  coverOf(tripId: string): Photo | null {
    return coverOf(this.photosOf(tripId));
  }

  /** O link da miniatura, se já foi pedido (`ensureThumbs`). */
  thumbUrl(photo: Photo): string | null {
    return this.valid(this.urls().get(photo.thumbPath));
  }

  fullUrl(photo: Photo): string | null {
    return this.valid(this.urls().get(photo.path));
  }

  /** A miniatura da capa de uma viagem, para as listas e as histórias. */
  coverThumbUrl(tripId: string): string | null {
    const cover = this.coverOf(tripId);
    return cover ? this.thumbUrl(cover) : null;
  }

  async load(): Promise<void> {
    const rows: PhotoRow[] = [];
    for (let start = 0; ; start += PAGE) {
      const page = await this.supabase
        .from('trip_photos')
        .select('*')
        .order('created_at')
        .order('id')
        .range(start, start + PAGE - 1)
        .returns<PhotoRow[]>();
      if (page.error || !page.data) {
        this.loadFailed.set(true);
        return;
      }
      rows.push(...page.data);
      if (page.data.length < PAGE) break;
    }
    this.loadFailed.set(false);
    this.photos.set(rows.map(toPhoto));
    this.loaded.set(true);
    // As capas precisam de miniatura logo, para as listas não aparecerem sem imagem.
    const covers = [...this.byTrip().values()].map((group) => group[0]);
    await this.sign(covers.map((photo) => photo.thumbPath));
  }

  /** Pede os links das miniaturas de uma viagem (a galeria chama isto ao abrir). */
  async ensureThumbs(tripId: string): Promise<void> {
    await this.sign(this.photosOf(tripId).map((photo) => photo.thumbPath));
  }

  /** Pede o link da foto em ecrã inteiro, e das vizinhas, para passar de uma a outra sem esperar. */
  async ensureFull(photos: readonly Photo[]): Promise<void> {
    await this.sign(photos.map((photo) => photo.path));
  }

  /** Pede os links e põe as fotos na cache do browser, para quando chegar a vez delas já estarem prontas. */
  async warm(photos: readonly Photo[]): Promise<void> {
    if (!photos.length) return;
    await this.sign(photos.flatMap((photo) => [photo.thumbPath, photo.path]));
    for (const photo of photos) {
      for (const url of [this.thumbUrl(photo), this.fullUrl(photo)]) {
        if (!url || this.warmed.has(url)) continue;
        this.warmed.add(url);
        const image = new Image();
        image.decoding = 'async';
        image.src = url;
      }
    }
  }

  /**
   * Comprime a foto, envia-a (e a miniatura) e regista-a na viagem. Se algo falhar a meio, não fica lixo no bucket.
   * Lança `PhotoError` com o motivo.
   */
  async upload(tripId: string, file: File): Promise<Photo> {
    const check = checkFile(file);
    if (check !== 'ok') throw new PhotoError(check);

    let compressed;
    try {
      compressed = await compressImage(file);
    } catch {
      throw new PhotoError('unsupported');
    }

    const id = crypto.randomUUID();
    const { path, thumbPath } = photoPaths(tripId, id);
    const storage = this.supabase.storage.from(BUCKET);

    const full = await storage.upload(path, compressed.full, { contentType: 'image/jpeg', upsert: false });
    if (full.error) throw new PhotoError('upload');
    const thumb = await storage.upload(thumbPath, compressed.thumb, { contentType: 'image/jpeg', upsert: false });
    if (thumb.error) {
      await storage.remove([path]);
      throw new PhotoError('upload');
    }

    const { data, error } = await this.supabase
      .from('trip_photos')
      .insert({ id, trip_id: tripId, path, thumb_path: thumbPath, width: compressed.width, height: compressed.height })
      .select('*')
      .single<PhotoRow>();
    if (error || !data) {
      await storage.remove([path, thumbPath]);
      throw new PhotoError('upload');
    }

    const photo = toPhoto(data);
    this.photos.update((photos) => [...photos, photo]);
    await this.sign([photo.thumbPath]);
    return photo;
  }

  async setCaption(photo: Photo, caption: string | null): Promise<void> {
    const { error } = await this.supabase.from('trip_photos').update({ caption }).eq('id', photo.id);
    if (error) throw error;
    this.photos.update((photos) => photos.map((item) => (item.id === photo.id ? { ...item, caption } : item)));
  }

  /** Apaga a foto: primeiro o registo (para deixar de aparecer) e depois os ficheiros. */
  async remove(photo: Photo): Promise<void> {
    const { error } = await this.supabase.from('trip_photos').delete().eq('id', photo.id);
    if (error) throw error;
    this.photos.update((photos) => photos.filter((item) => item.id !== photo.id));
    await this.supabase.storage.from(BUCKET).remove([photo.path, photo.thumbPath]);
  }

  /**
   * Apaga os ficheiros de todas as fotos de uma viagem. Chama-se antes de apagar a viagem: os registos saem
   * sozinhos com ela, mas a base de dados não chega ao bucket.
   */
  async removeFilesOfTrip(tripId: string): Promise<void> {
    const files = this.photosOf(tripId).flatMap((photo) => [photo.path, photo.thumbPath]);
    if (files.length) await this.supabase.storage.from(BUCKET).remove(files);
  }

  private valid(entry: SignedUrl | undefined): string | null {
    return entry && entry.expiresAt - URL_MARGIN_MS > Date.now() ? entry.url : null;
  }

  /** Pede links temporários para os caminhos que ainda não têm um válido. */
  private async sign(paths: readonly string[]): Promise<void> {
    const wanted = [...new Set(paths)].filter((path) => !this.valid(this.urls().get(path)));
    if (!wanted.length) return;
    const { data, error } = await this.supabase.storage.from(BUCKET).createSignedUrls(wanted, URL_TTL_SECONDS);
    if (error || !data) return;
    const expiresAt = Date.now() + URL_TTL_SECONDS * 1000;
    const next = new Map(this.urls());
    for (const item of data) {
      if (item.path && item.signedUrl) next.set(item.path, { url: item.signedUrl, expiresAt });
    }
    this.urls.set(next);
  }

  private listen(): void {
    if (this.channel) return;
    this.channel = this.supabase
      .channel('contigo-photos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_photos' }, () => void this.load())
      .subscribe();
  }

  private stopListening(): void {
    if (!this.channel) return;
    void this.supabase.removeChannel(this.channel);
    this.channel = null;
  }
}
