import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

/**
 * Mantém a PWA em dia sem a apagar, sem nunca te interromper. O iPhone só procura uma versão nova quando abre a app,
 * e a mostra à abertura seguinte. Aqui procura-se ao abrir e sempre que a app volta ao primeiro plano, mas uma versão
 * nova só se aplica (o que recarrega a página) no momento em que a app volta ao primeiro plano e ainda ninguém lhe
 * tocou. O ecrã de abertura não volta a aparecer nesse recarregamento (ver index.html): não é uma abertura. Se a
 * versão for achada com a app já em uso, fica à espera dessa altura, em vez de recarregar por cima do que se faz.
 */
@Injectable({ providedIn: 'root' })
export class UpdateService {
  private readonly updates = inject(SwUpdate);
  private readonly document = inject(DOCUMENT);
  private checking = false;
  /** Já se sabe que há uma versão nova por aplicar. */
  private pending = false;

  constructor() {
    if (!this.updates.isEnabled) return;
    this.document.addEventListener('visibilitychange', () => {
      if (this.document.visibilityState !== 'visible') return;
      // A app voltou e ainda ninguém lhe tocou: é a altura certa para trocar de versão.
      if (this.pending) void this.apply();
      else void this.check();
    });
    // Se o service worker ficar num estado que não se recupera, recarregar é o que o resolve.
    this.updates.unrecoverable.subscribe(() => this.reload());
    void this.check();
  }

  /** Só procura e regista: nunca recarrega a meio do uso. */
  private async check(): Promise<void> {
    if (this.checking) return;
    this.checking = true;
    try {
      if (await this.updates.checkForUpdate()) this.pending = true;
    } catch {
      // Sem rede ou o service worker a meio de algo: tenta-se outra vez da próxima vez que a app aparecer.
    } finally {
      this.checking = false;
    }
  }

  private async apply(): Promise<void> {
    try {
      await this.updates.activateUpdate();
      this.reload();
    } catch {
      this.pending = false;
    }
  }

  private reload(): void {
    // A página recarrega com a app já aberta: o ecrã de abertura não volta a aparecer (ver index.html).
    try {
      sessionStorage.setItem('contigo.reloading', '1');
    } catch {
      // Sem sessionStorage, mostra-se o ecrã de abertura, como antes.
    }
    this.document.location.reload();
  }
}
