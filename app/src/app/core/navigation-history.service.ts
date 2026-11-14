import { inject, Injectable } from '@angular/core';
import { Location } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/**
 * Sabe se há para onde voltar dentro da app. A seta de voltar usa-a para ir ao sítio de onde se veio (o Início, Nós,
 * o Mapa…) em vez de ir sempre para o mesmo ecrã; se a pessoa chegou diretamente a esta página (um link, o ecrã
 * principal), vai para o ecrã que se escolheu por defeito.
 */
@Injectable({ providedIn: 'root' })
export class NavigationHistory {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private navigations = 0;

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => this.navigations++);
  }

  /** Mais do que uma navegação desde que a app abriu quer dizer que há um ecrã anterior da própria app. */
  get canGoBack(): boolean {
    return this.navigations > 1;
  }

  back(fallback: string): void {
    if (this.canGoBack) this.location.back();
    else void this.router.navigateByUrl(fallback, { replaceUrl: true });
  }
}
