import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ActivityItem, ActivityRow, collapse, toActivity, unreadCount } from './activity.logic';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

/** Quantas novidades se vão buscar de cada vez: chega para semanas de uso a dois. */
const LIMIT = 120;

/**
 * As novidades: o que o outro foi fazendo na app. Quem as escreve são os gatilhos da base de dados. Aqui só se leem,
 * se contam as que ainda não se viram e se marca "lido". Atualiza-se sozinha quando o outro faz alguma coisa.
 */
@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private channel: RealtimeChannel | null = null;

  private readonly all = signal<ActivityItem[]>([]);
  /** A última novidade que já se leu (o instante em que ela foi feita, na hora do servidor). */
  readonly readAt = signal<string | null>(null);
  readonly loaded = signal(false);
  readonly loadFailed = signal(false);

  /** Só o que o outro fez, a mais recente primeiro (o que fiz eu já eu sei). */
  readonly items = computed(() => this.all().filter((item) => item.actor !== this.auth.userId()));
  readonly entries = computed(() => collapse(this.items()));
  readonly unread = computed(() => unreadCount(this.items(), this.auth.userId(), this.readAt()));

  constructor() {
    effect(() => {
      const userId = this.auth.userId();
      // Recarrega quando a rede volta, a app volta ao primeiro plano ou a sessão se renova.
      this.auth.reload();
      untracked(() => {
        if (userId) {
          void this.load(userId);
          this.listen();
        } else {
          this.stopListening();
          this.all.set([]);
          this.readAt.set(null);
          this.loaded.set(false);
        }
      });
    });
  }

  async load(userId = this.auth.userId()): Promise<void> {
    if (!userId || this.auth.stale()) return;
    const [activity, profile] = await Promise.all([
      this.supabase.from('activity').select('*').order('created_at', { ascending: false }).limit(LIMIT).returns<ActivityRow[]>(),
      this.supabase.from('profiles').select('activity_read_at').eq('id', userId).maybeSingle<{ activity_read_at: string | null }>(),
    ]);
    if (activity.error || !activity.data) {
      this.loadFailed.set(true);
      return;
    }
    this.loadFailed.set(false);
    this.all.set(activity.data.map(toActivity));
    this.readAt.set(profile.data?.activity_read_at ?? null);
    this.loaded.set(true);
  }

  /** Marca tudo o que há como lido: fica a data da novidade mais recente, que é do servidor e por isso não depende do relógio do telemóvel. */
  async markRead(): Promise<void> {
    const userId = this.auth.userId();
    const newest = this.all()[0]?.createdAt;
    if (!userId || !newest || (this.readAt() && newest <= (this.readAt() as string))) return;
    this.readAt.set(newest);
    const { error } = await this.supabase.from('profiles').update({ activity_read_at: newest }).eq('id', userId);
    if (error) void this.load(userId);
  }

  private listen(): void {
    if (this.channel) return;
    this.channel = this.supabase
      .channel('contigo-activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity' }, () => void this.load())
      .subscribe();
  }

  private stopListening(): void {
    if (!this.channel) return;
    void this.supabase.removeChannel(this.channel);
    this.channel = null;
  }
}
