import { Component, computed, inject, model } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageService } from '../../core/language.service';
import { ALL_MONTHS, formatMonths, monthName } from '../../core/wish-readiness.logic';

/** Escolher a altura ideal: um ou mais meses, ou "o ano todo". `null` é "ainda por preencher". */
@Component({
  selector: 'app-month-picker',
  imports: [TranslocoPipe],
  template: `
    <div class="months" role="group" [attr.aria-label]="'wish.months.title' | transloco">
      <button class="all" type="button" [class.on]="allYear()" [attr.aria-pressed]="allYear()" (click)="toggleAll()">
        {{ 'wish.months.allYear' | transloco }}
      </button>
      @for (month of all; track month) {
        <button type="button" [class.on]="has(month)" [attr.aria-pressed]="has(month)" (click)="toggle(month)">
          {{ name(month) }}
        </button>
      }
    </div>
    @if (summary(); as text) {
      <p class="summary">{{ text }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .months {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }
    button {
      min-height: 44px;
      padding: 0 4px;
      border: 1.5px solid var(--ct-ln);
      border-radius: 14px;
      background: transparent;
      color: var(--ct-tx);
      font: 600 14px var(--ion-font-family);
      text-transform: capitalize;
      cursor: pointer;
      transition: background-color var(--ct-dur-fast), border-color var(--ct-dur-fast), transform var(--ct-dur-fast);
      &:active {
        transform: scale(0.96);
      }
      &.on {
        background: var(--ct-acs);
        border-color: var(--ct-ac);
        color: var(--ct-act);
      }
    }
    .all {
      grid-column: 1 / -1;
      text-transform: none;
    }
    .summary {
      margin: 10px 2px 0;
      font-size: 14px;
      color: var(--ct-mu);
    }
  `,
})
export class MonthPickerComponent {
  private readonly language = inject(LanguageService).language;

  /** Os meses escolhidos (1 a 12), ou `null` enquanto não se escolheu nada. */
  readonly months = model<number[] | null>(null);
  protected readonly all = ALL_MONTHS;
  protected readonly allYear = computed(() => (this.months()?.length ?? 0) === 12);
  protected readonly summary = computed(() => {
    const months = this.months();
    if (!months?.length || this.allYear()) return '';
    return formatMonths(months, this.language(), '', this.language() === 'en' ? 'to' : 'a');
  });

  protected name(month: number): string {
    return monthName(month, this.language(), 'short').replace('.', '');
  }

  protected has(month: number): boolean {
    return this.months()?.includes(month) ?? false;
  }

  protected toggle(month: number): void {
    const current = this.months() ?? [];
    const next = current.includes(month) ? current.filter((item) => item !== month) : [...current, month].sort((a, b) => a - b);
    this.months.set(next.length ? next : null);
  }

  protected toggleAll(): void {
    this.months.set(this.allYear() ? null : [...ALL_MONTHS]);
  }
}
