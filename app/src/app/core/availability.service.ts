import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import {
  addDays,
  commonWindows,
  DayMark,
  DayMarkRow,
  freeDays,
  markedDays,
  nextWindow,
  ShiftKind,
  ShiftTone,
  ShiftType,
  ShiftTypeRow,
  toDayMark,
  toShiftType,
  todayIso,
} from './availability.logic';
import { ProfileService } from './profile.service';
import { SupabaseService } from './supabase.service';

export interface ShiftInput {
  name: string;
  kind: ShiftKind;
  startsAt: string | null;
  endsAt: string | null;
  tone: ShiftTone;
}

/** Os dias de que a app precisa: um pouco para trás, para o calendário do mês atual, e mais de um ano para a frente. */
const DAYS_BEFORE = 62;
const DAYS_AFTER = 430;
const PAGE = 1000;

/** A disponibilidade dos dois: os tipos de turno e os dias marcados. Atualiza-se sozinha quando o outro mexe nela. */
@Injectable({ providedIn: 'root' })
export class AvailabilityService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private readonly profile = inject(ProfileService);
  private channel: RealtimeChannel | null = null;

  readonly types = signal<ShiftType[]>([]);
  readonly marks = signal<DayMark[]>([]);
  readonly loaded = signal(false);
  readonly loadFailed = signal(false);

  /** Os meus tipos de turno, por ordem alfabética. */
  readonly myTypes = computed(() =>
    this.types()
      .filter((type) => type.userId === this.auth.userId())
      .sort((a, b) => a.name.localeCompare(b.name, 'pt')),
  );
  private readonly typesById = computed(() => new Map(this.types().map((type) => [type.id, type])));

  /** Os dias que cada um marcou, com o tipo de cada dia. */
  readonly myDays = computed(() => markedDays(this.marks(), this.auth.userId()));
  readonly partnerDays = computed(() => markedDays(this.marks(), this.profile.partner()?.id ?? null));

  private readonly myFree = computed(() => freeDays(this.marks(), this.types(), this.auth.userId()));
  private readonly partnerFree = computed(() => freeDays(this.marks(), this.types(), this.profile.partner()?.id ?? null));

  /** Os blocos de dias seguidos em que os dois estão livres, daqui para a frente. */
  readonly windows = computed(() => commonWindows(this.myFree(), this.partnerFree(), todayIso()));
  readonly next = computed(() => nextWindow(this.windows(), todayIso()));

  constructor() {
    effect(() => {
      const userId = this.auth.userId();
      untracked(() => {
        if (userId) {
          void this.load();
          this.listen();
        } else {
          this.stopListening();
          this.types.set([]);
          this.marks.set([]);
          this.loaded.set(false);
        }
      });
    });
  }

  typeOf(typeId: string | undefined): ShiftType | null {
    return (typeId && this.typesById().get(typeId)) || null;
  }

  /** Quantos dias meus usam este tipo (para avisar antes de o apagar). */
  daysUsing(typeId: string): number {
    let count = 0;
    for (const id of this.myDays().values()) if (id === typeId) count += 1;
    return count;
  }

  async load(): Promise<void> {
    const today = todayIso();
    const from = addDays(today, -DAYS_BEFORE);
    const to = addDays(today, DAYS_AFTER);

    const types = await this.supabase.from('shift_types').select('*').returns<ShiftTypeRow[]>();
    if (types.error || !types.data) {
      this.loadFailed.set(true);
      return;
    }

    // O servidor devolve no máximo 1000 linhas de cada vez: vai-se buscando página a página.
    const rows: DayMarkRow[] = [];
    for (let start = 0; ; start += PAGE) {
      const page = await this.supabase
        .from('availability_days')
        .select('*')
        .gte('day', from)
        .lte('day', to)
        .order('day')
        .order('user_id')
        .range(start, start + PAGE - 1)
        .returns<DayMarkRow[]>();
      if (page.error || !page.data) {
        this.loadFailed.set(true);
        return;
      }
      rows.push(...page.data);
      if (page.data.length < PAGE) break;
    }

    this.loadFailed.set(false);
    this.types.set(types.data.map(toShiftType));
    this.marks.set(rows.map(toDayMark));
    this.loaded.set(true);
  }

  async createType(input: ShiftInput): Promise<ShiftType> {
    const { data, error } = await this.supabase
      .from('shift_types')
      .insert(this.toRow(input))
      .select('*')
      .single<ShiftTypeRow>();
    if (error || !data) throw error ?? new Error('Não foi possível guardar o tipo de turno.');
    const created = toShiftType(data);
    this.types.update((types) => [...types, created]);
    return created;
  }

  async updateType(typeId: string, input: ShiftInput): Promise<void> {
    const { data, error } = await this.supabase
      .from('shift_types')
      .update(this.toRow(input))
      .eq('id', typeId)
      .select('*')
      .single<ShiftTypeRow>();
    if (error || !data) throw error ?? new Error('Não foi possível guardar o tipo de turno.');
    const updated = toShiftType(data);
    this.types.update((types) => types.map((type) => (type.id === typeId ? updated : type)));
  }

  /** Apaga o tipo e, na base de dados, as marcações que o usam. */
  async deleteType(typeId: string): Promise<void> {
    const { error } = await this.supabase.from('shift_types').delete().eq('id', typeId);
    if (error) throw error;
    this.types.update((types) => types.filter((type) => type.id !== typeId));
    this.marks.update((marks) => marks.filter((mark) => mark.shiftTypeId !== typeId));
  }

  /** Marca estes dias com um tipo (ou, sem tipo, tira a marcação). */
  async apply(days: readonly string[], typeId: string | null): Promise<void> {
    const userId = this.auth.userId();
    if (!userId || !days.length) return;

    if (typeId === null) {
      const { error } = await this.supabase.from('availability_days').delete().eq('user_id', userId).in('day', [...days]);
      if (error) throw error;
      const gone = new Set(days);
      this.marks.update((marks) => marks.filter((mark) => mark.userId !== userId || !gone.has(mark.day)));
      return;
    }

    const rows = days.map((day) => ({ day, shift_type_id: typeId }));
    const { error } = await this.supabase.from('availability_days').upsert(rows, { onConflict: 'user_id,day' });
    if (error) throw error;
    const changed = new Set(days);
    this.marks.update((marks) => [
      ...marks.filter((mark) => mark.userId !== userId || !changed.has(mark.day)),
      ...days.map((day) => ({ userId, day, shiftTypeId: typeId })),
    ]);
  }

  private toRow(input: ShiftInput) {
    return {
      name: input.name,
      kind: input.kind,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      tone: input.tone,
    };
  }

  private listen(): void {
    if (this.channel) return;
    const reload = () => void this.load();
    this.channel = this.supabase
      .channel('contigo-availability')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_types' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'availability_days' }, reload)
      .subscribe();
  }

  private stopListening(): void {
    if (!this.channel) return;
    void this.supabase.removeChannel(this.channel);
    this.channel = null;
  }
}
