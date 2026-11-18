import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import {
  checkDoc,
  DocCheck,
  DocRow,
  docPath,
  mimeOf,
  NoteColor,
  NoteRow,
  nameFromFile,
  sortNotes,
  toDoc,
  toNote,
  TripDoc,
  TripNote,
} from './trip-docs.logic';

const BUCKET = 'trip-documents';
/** O link para abrir um documento dura 10 minutos: chega para o abrir e descarregar. */
const URL_TTL_SECONDS = 10 * 60;

/** Um erro de envio com o motivo, para o ecrã dizer o que correu mal. */
export class DocError extends Error {
  constructor(readonly reason: Exclude<DocCheck, 'ok'> | 'upload') {
    super(reason);
    this.name = 'DocError';
  }
}

/**
 * Os documentos de cada viagem: post-its e ficheiros. Os ficheiros ficam num bucket privado e abrem-se com links
 * temporários. Atualiza-se sozinho quando o outro junta ou apaga alguma coisa.
 */
@Injectable({ providedIn: 'root' })
export class TripDocsService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private channel: RealtimeChannel | null = null;

  private readonly notes = signal<TripNote[]>([]);
  private readonly docs = signal<TripDoc[]>([]);
  readonly loaded = signal(false);
  readonly loadFailed = signal(false);

  private readonly notesByTrip = computed(() => {
    const map = new Map<string, TripNote[]>();
    for (const note of this.notes()) map.set(note.tripId, [...(map.get(note.tripId) ?? []), note]);
    return map;
  });
  private readonly docsByTrip = computed(() => {
    const map = new Map<string, TripDoc[]>();
    for (const doc of this.docs()) map.set(doc.tripId, [...(map.get(doc.tripId) ?? []), doc]);
    return map;
  });

  constructor() {
    effect(() => {
      const userId = this.auth.userId();
      untracked(() => {
        if (userId) {
          void this.load();
          this.listen();
        } else {
          this.stopListening();
          this.notes.set([]);
          this.docs.set([]);
          this.loaded.set(false);
        }
      });
    });
  }

  notesOf(tripId: string): TripNote[] {
    return sortNotes(this.notesByTrip().get(tripId) ?? []);
  }

  docsOf(tripId: string): TripDoc[] {
    return this.docsByTrip().get(tripId) ?? [];
  }

  async load(): Promise<void> {
    const [notes, docs] = await Promise.all([
      this.supabase.from('trip_notes').select('*').order('created_at').returns<NoteRow[]>(),
      this.supabase.from('trip_documents').select('*').order('created_at').returns<DocRow[]>(),
    ]);
    if (notes.error || docs.error) {
      this.loadFailed.set(true);
      return;
    }
    this.loadFailed.set(false);
    this.notes.set((notes.data ?? []).map(toNote));
    this.docs.set((docs.data ?? []).map(toDoc));
    this.loaded.set(true);
  }

  // ------------------------------------------------------------ post-its

  async addNote(tripId: string, input: { body: string; color: NoteColor; pinned: boolean }): Promise<void> {
    await this.run(this.supabase.from('trip_notes').insert({ trip_id: tripId, body: input.body.trim(), color: input.color, pinned: input.pinned }));
  }

  async updateNote(id: string, input: { body: string; color: NoteColor; pinned: boolean }): Promise<void> {
    await this.run(this.supabase.from('trip_notes').update({ body: input.body.trim(), color: input.color, pinned: input.pinned }).eq('id', id));
  }

  async removeNote(id: string): Promise<void> {
    await this.run(this.supabase.from('trip_notes').delete().eq('id', id));
  }

  // ------------------------------------------------------------ ficheiros

  /** Envia o ficheiro e regista-o na viagem. Se algo falhar a meio, não fica lixo no bucket. Lança `DocError`. */
  async upload(tripId: string, file: File): Promise<TripDoc> {
    const check = checkDoc(file);
    if (check !== 'ok') throw new DocError(check);
    const mime = mimeOf(file) as string;

    const id = crypto.randomUUID();
    const path = docPath(tripId, id, mime);
    const storage = this.supabase.storage.from(BUCKET);
    const sent = await storage.upload(path, file, { contentType: mime, upsert: false });
    if (sent.error) throw new DocError('upload');

    const { data, error } = await this.supabase
      .from('trip_documents')
      .insert({ id, trip_id: tripId, path, name: nameFromFile(file.name), mime, size_bytes: file.size })
      .select('*')
      .single<DocRow>();
    if (error || !data) {
      await storage.remove([path]);
      throw new DocError('upload');
    }
    const doc = toDoc(data);
    this.docs.update((docs) => [...docs, doc]);
    return doc;
  }

  async updateDoc(id: string, input: { name: string; note: string | null }): Promise<void> {
    await this.run(this.supabase.from('trip_documents').update({ name: input.name.trim(), note: input.note?.trim() || null }).eq('id', id));
  }

  /** Apaga o documento: primeiro o registo (para deixar de aparecer) e depois o ficheiro. */
  async removeDoc(doc: TripDoc): Promise<void> {
    const { error } = await this.supabase.from('trip_documents').delete().eq('id', doc.id);
    if (error) throw error;
    this.docs.update((docs) => docs.filter((item) => item.id !== doc.id));
    await this.supabase.storage.from(BUCKET).remove([doc.path]);
  }

  /** Um link temporário para abrir o documento (no fim, `null` se não foi possível). */
  async urlOf(doc: TripDoc): Promise<string | null> {
    const { data, error } = await this.supabase.storage.from(BUCKET).createSignedUrl(doc.path, URL_TTL_SECONDS);
    return error || !data ? null : data.signedUrl;
  }

  /**
   * Abre o documento (PDF ou imagem) fora da app. A janela abre-se já, no toque, porque o iOS não deixa abrir uma
   * depois de esperar pelo link; o link só se põe nela quando chega.
   */
  async open(doc: TripDoc): Promise<boolean> {
    const win = window.open('', '_blank');
    const url = await this.urlOf(doc);
    if (!url) {
      win?.close();
      return false;
    }
    if (win) win.location.href = url;
    else window.location.href = url;
    return true;
  }

  /** Apaga os ficheiros de uma viagem. Chama-se antes de apagar a viagem: os registos saem com ela, o bucket não. */
  async removeFilesOfTrip(tripId: string): Promise<void> {
    const files = this.docsOf(tripId).map((doc) => doc.path);
    if (files.length) await this.supabase.storage.from(BUCKET).remove(files);
  }

  // ------------------------------------------------------------

  private async run(query: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
    const { error } = await query;
    if (error) throw new Error(error.message);
    await this.load();
  }

  private listen(): void {
    if (this.channel) return;
    const reload = () => void this.load();
    this.channel = this.supabase
      .channel('contigo-trip-docs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_notes' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_documents' }, reload)
      .subscribe();
  }

  private stopListening(): void {
    if (!this.channel) return;
    void this.supabase.removeChannel(this.channel);
    this.channel = null;
  }
}
