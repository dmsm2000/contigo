import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { countByStatus, Idea, IdeaRow, IdeaStatus, sortIdeas, toIdea } from './ideas.logic';
import { SupabaseService } from './supabase.service';

/** A lista de ideias dos dois. Atualiza-se sozinha quando o outro escreve, muda ou apaga alguma. */
@Injectable({ providedIn: 'root' })
export class IdeasService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private channel: RealtimeChannel | null = null;

  readonly items = signal<Idea[]>([]);
  readonly loaded = signal(false);
  readonly loadFailed = signal(false);

  readonly sorted = computed(() => sortIdeas(this.items()));
  readonly counts = computed(() => countByStatus(this.items()));

  constructor() {
    effect(() => {
      const userId = this.auth.userId();
      untracked(() => {
        if (userId) {
          void this.load();
          this.listen();
        } else {
          this.stopListening();
          this.items.set([]);
          this.loaded.set(false);
        }
      });
    });
  }

  isMine(idea: Idea): boolean {
    return idea.userId === this.auth.userId();
  }

  async load(): Promise<void> {
    const { data, error } = await this.supabase
      .from('ideas')
      .select('*')
      .order('created_at', { ascending: false })
      .returns<IdeaRow[]>();
    if (error || !data) {
      this.loadFailed.set(true);
      return;
    }
    this.loadFailed.set(false);
    this.items.set(data.map(toIdea));
    this.loaded.set(true);
  }

  async add(body: string): Promise<void> {
    const { error } = await this.supabase.from('ideas').insert({ body });
    if (error) throw error;
    await this.load();
  }

  /** Só quem escreveu a ideia lhe pode mudar o texto (a base de dados recusa aos outros). */
  async edit(id: string, body: string): Promise<void> {
    const { error } = await this.supabase.from('ideas').update({ body }).eq('id', id);
    if (error) throw error;
    await this.load();
  }

  /** O estado muda-o qualquer um dos dois. */
  async setStatus(id: string, status: IdeaStatus): Promise<void> {
    // Muda logo no ecrã e volta atrás se a base de dados recusar.
    const before = this.items();
    this.items.update((items) => items.map((idea) => (idea.id === id ? { ...idea, status } : idea)));
    const { error } = await this.supabase.from('ideas').update({ status }).eq('id', id);
    if (error) {
      this.items.set(before);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.from('ideas').delete().eq('id', id);
    if (error) throw error;
    await this.load();
  }

  private listen(): void {
    if (this.channel) return;
    this.channel = this.supabase
      .channel('contigo-ideas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ideas' }, () => void this.load())
      .subscribe();
  }

  private stopListening(): void {
    if (!this.channel) return;
    void this.supabase.removeChannel(this.channel);
    this.channel = null;
  }
}
