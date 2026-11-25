import { Injectable } from '@angular/core';

/**
 * Diz ao ecrã de abertura (em main.ts) que o primeiro ecrã já tem os dados que mostra, para ele só sair quando há
 * conteúdo e não um esqueleto. Quem quiser esperar (o Início) chama `ready()`; sem isso, o ecrã de abertura sai por si.
 */
@Injectable({ providedIn: 'root' })
export class FirstScreenService {
  private resolve: () => void = () => undefined;
  /** Resolve quando o primeiro ecrã avisa que está pronto. */
  readonly whenReady = new Promise<void>((resolve) => (this.resolve = resolve));

  ready(): void {
    this.resolve();
  }
}
