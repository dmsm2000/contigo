import { Injectable, signal } from '@angular/core';

/** Quanto tempo a app tem de ter estado fora do primeiro plano para, ao voltar, se recarregarem os dados. */
const AWAY_MS = 30_000;

/**
 * Se há rede e quando é altura de ir buscar os dados outra vez: quando a rede volta, e quando a app volta ao primeiro
 * plano depois de um bocado fora (no telemóvel, a app suspensa não vê a rede voltar nem as mudanças do outro).
 */
@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  private readonly onlineState = signal(navigator.onLine);
  private readonly refreshState = signal(0);

  /** O que o browser diz: pode haver wifi sem internet, por isso é uma pista e não uma certeza. */
  readonly online = this.onlineState.asReadonly();
  /** Sobe de cada vez que convém recarregar os dados; quem a lê dentro de um `effect` recarrega com ela. */
  readonly refresh = this.refreshState.asReadonly();

  constructor() {
    window.addEventListener('online', () => {
      this.onlineState.set(true);
      this.bump();
    });
    window.addEventListener('offline', () => this.onlineState.set(false));

    let hiddenAt = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt >= AWAY_MS) {
        hiddenAt = 0;
        this.onlineState.set(navigator.onLine);
        this.bump();
      }
    });
  }

  private bump(): void {
    this.refreshState.update((count) => count + 1);
  }
}
