import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

/**
 * Mantém a PWA em dia sem a apagar. O iPhone só procura uma versão nova quando abre a app, e a mostra à
 * abertura seguinte. Aqui procura-se sempre que a app volta ao primeiro plano e, se houver versão nova, ativa-se e
 * recarrega-se logo, antes de o utilizador mexer (por isso não se perde nada do que se estava a escrever).
 */
@Injectable({ providedIn: 'root' })
export class UpdateService {
  private readonly updates = inject(SwUpdate);
  private readonly document = inject(DOCUMENT);
  private checking = false;

  constructor() {
    if (!this.updates.isEnabled) return;
    this.document.addEventListener('visibilitychange', () => {
      if (this.document.visibilityState === 'visible') void this.check();
    });
    // Se o service worker ficar num estado que não se recupera, recarregar é o que o resolve.
    this.updates.unrecoverable.subscribe(() => this.reload());
    void this.check();
  }

  private async check(): Promise<void> {
    if (this.checking) return;
    this.checking = true;
    try {
      if (await this.updates.checkForUpdate()) {
        await this.updates.activateUpdate();
        this.reload();
      }
    } catch {
      // Sem rede ou o service worker a meio de algo: tenta-se outra vez da próxima vez que a app aparecer.
    } finally {
      this.checking = false;
    }
  }

  private reload(): void {
    this.document.location.reload();
  }
}
