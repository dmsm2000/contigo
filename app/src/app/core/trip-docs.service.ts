import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { ConnectivityService } from './connectivity.service';
import { DocCacheService } from './doc-cache.service';
import { readSnapshot, writeSnapshot } from './offline-store';
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

/** O que aconteceu ao abrir um documento: abriu, não deu por falta de rede (e de cópia no telemóvel), ou falhou. */
export type OpenResult = 'opened' | 'offline' | 'failed';

/** Um erro de envio com o motivo, para o ecrã dizer o que correu mal. */
export class DocError extends Error {
  /** `detail`: o que a base de dados ou o armazenamento responderam (só para se perceber o que falhou). */
  constructor(readonly reason: Exclude<DocCheck, 'ok'> | 'upload' | 'unreadable', readonly detail?: string) {
    super(detail ? `${reason}: ${detail}` : reason);
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
  private readonly connectivity = inject(ConnectivityService);
  private readonly saved = inject(DocCacheService);
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
      const stale = this.auth.stale();
      // Recarrega quando a rede volta ou a app volta ao primeiro plano.
      this.connectivity.refresh();
      untracked(() => {
        if (userId) {
          this.restore(userId);
          void this.load();
          if (!stale) this.listen();
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

  /** Os post-its e a lista de ficheiros da última vez, para aparecerem logo (e sem rede). */
  private restore(userId: string): void {
    if (this.loaded()) return;
    const notes = readSnapshot<NoteRow>(userId, 'trip-notes');
    const docs = readSnapshot<DocRow>(userId, 'trip-docs');
    if (!notes || !docs) return;
    this.notes.set(notes.map(toNote));
    this.docs.set(docs.map(toDoc));
    this.loaded.set(true);
  }

  async load(): Promise<void> {
    // Com a sessão só guardada (sem rede), um pedido iria como anónimo e voltaria vazio: ficam as cópias.
    if (this.auth.stale()) return;
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
    const userId = this.auth.userId();
    if (userId) {
      writeSnapshot(userId, 'trip-notes', notes.data ?? []);
      writeSnapshot(userId, 'trip-docs', docs.data ?? []);
    }
    // Os ficheiros guardados de documentos que entretanto se apagaram já não fazem falta.
    void this.saved.prune((docs.data ?? []).map((doc) => doc.id));
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
    // No iPhone, um ficheiro que está no iCloud, no Mail ou nas transferências pode ainda não estar no telemóvel e o
    // Safari recusa lê-lo na hora de enviar. Lê-se já para a memória: se falhar, sabe-se logo o motivo.
    let body: Blob;
    try {
      body = new Blob([await file.arrayBuffer()], { type: mime });
    } catch (error) {
      console.error('Não foi possível ler o ficheiro:', error);
      throw new DocError('unreadable');
    }
    const sent = await storage.upload(path, body, { contentType: mime, upsert: false });
    if (sent.error) {
      console.error('Envio do documento (armazenamento):', sent.error);
      throw new DocError('upload', `armazenamento: ${sent.error.message}`);
    }

    const { data, error } = await this.supabase
      .from('trip_documents')
      .insert({ id, trip_id: tripId, path, name: nameFromFile(file.name), mime, size_bytes: file.size })
      .select('*')
      .single<DocRow>();
    if (error || !data) {
      console.error('Envio do documento (registo):', error);
      await storage.remove([path]);
      throw new DocError('upload', `registo: ${error?.message ?? 'sem resposta'}`);
    }
    const doc = toDoc(data);
    this.docs.update((docs) => [...docs, doc]);
    return doc;
  }

  async updateDoc(id: string, input: { name: string; note: string | null; legId: string | null }): Promise<void> {
    await this.run(this.supabase.from('trip_documents').update({ name: input.name.trim(), note: input.note?.trim() || null, leg_id: input.legId }).eq('id', id));
  }

  /** Apaga o documento: primeiro o registo (para deixar de aparecer) e depois o ficheiro. */
  async removeDoc(doc: TripDoc): Promise<void> {
    const { error } = await this.supabase.from('trip_documents').delete().eq('id', doc.id);
    if (error) throw error;
    this.docs.update((docs) => docs.filter((item) => item.id !== doc.id));
    await this.saved.remove(doc.id);
    await this.supabase.storage.from(BUCKET).remove([doc.path]);
  }

  /** Um link temporário para abrir o documento (no fim, `null` se não foi possível). */
  async urlOf(doc: TripDoc): Promise<string | null> {
    const { data, error } = await this.supabase.storage.from(BUCKET).createSignedUrl(doc.path, URL_TTL_SECONDS);
    return error || !data ? null : data.signedUrl;
  }

  /** O ficheiro todo, para o guardar no telemóvel (nulo se não foi possível). */
  async download(doc: TripDoc): Promise<Blob | null> {
    const { data, error } = await this.supabase.storage.from(BUCKET).download(doc.path);
    return error || !data ? null : data;
  }

  /**
   * Abre o documento (PDF ou imagem) fora da app. A janela abre-se já, no toque, porque o iOS não deixa abrir uma
   * depois de esperar pelo link; o link só se põe nela quando chega. Se o ficheiro já está guardado no telemóvel,
   * abre-se esse (e funciona sem rede).
   */
  async open(doc: TripDoc): Promise<OpenResult> {
    const win = window.open('', '_blank');
    const copy = await this.saved.get(doc.id);
    let url: string | null = null;
    if (copy) {
      url = URL.createObjectURL(copy);
      // A janela já o carregou; larga-se mais tarde para não ficar na memória.
      setTimeout(() => URL.revokeObjectURL(url as string), 10 * 60_000);
    } else if (!this.connectivity.online() || this.auth.stale()) {
      win?.close();
      return 'offline';
    } else {
      url = await this.urlOf(doc);
    }
    if (!url) {
      win?.close();
      // Sem rede o browser nem sempre sabe (wifi sem internet): se a última ida à rede também falhou, é por isso.
      return !this.connectivity.online() || this.loadFailed() ? 'offline' : 'failed';
    }
    if (win) win.location.href = url;
    else window.location.href = url;
    return 'opened';
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
