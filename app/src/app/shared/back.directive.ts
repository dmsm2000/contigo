import { Directive, HostListener, inject, input } from '@angular/core';
import { NavigationHistory } from '../core/navigation-history.service';

/** A seta de voltar: vai ao ecrã de onde se veio; se não houver, ao que está em `appBack` (por exemplo "/home"). */
@Directive({ selector: '[appBack]' })
export class BackDirective {
  private readonly history = inject(NavigationHistory);

  /** O ecrã para onde ir quando não há de onde voltar. */
  readonly appBack = input.required<string>();

  @HostListener('click', ['$event'])
  protected onClick(event: Event): void {
    event.preventDefault();
    this.history.back(this.appBack());
  }
}
