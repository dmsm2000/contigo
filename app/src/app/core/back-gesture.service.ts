import { inject, Injectable } from '@angular/core';
import { ModalController, NavController } from '@ionic/angular';
import { NavigationHistory } from './navigation-history.service';

/**
 * O gesto de voltar do sistema (deslizar a partir da borda no iPhone, o botão de voltar noutros telemóveis) anda para
 * trás no histórico do navegador. Dois cuidados para ele se sentir bem:
 *
 * 1. Com uma janela aberta (os formulários e detalhes sobem por cima), voltar fecha a janela e não muda a página que
 *    está por baixo. Cada janela aberta guarda uma entrada no histórico, que sai quando a janela fecha.
 * 2. Quando é o sistema a voltar, ele já faz a sua animação; a app não acrescenta a dela por cima (era o "duas vezes").
 *    As voltas da própria seta continuam a animar como antes.
 */
@Injectable({ providedIn: 'root' })
export class BackGestureService {
  private readonly modals = inject(ModalController);
  private readonly nav = inject(NavController);
  private readonly history = inject(NavigationHistory);

  /** As entradas do histórico que guardámos para as janelas abertas, da mais antiga para a mais recente. */
  private readonly marks: number[] = [];
  private nextId = 1;
  /** Voltas do histórico que a própria app fez ao fechar uma janela, e que não são um pedido para voltar. */
  private ignoredPops = 0;
  /** Janelas que estão a fechar porque o utilizador voltou (o histórico já andou). */
  private closingByBack = 0;

  constructor() {
    document.addEventListener('ionModalWillPresent', (event) => this.onPresent(event), true);
    document.addEventListener('ionModalDidDismiss', (event) => this.onDismiss(event), true);
    window.addEventListener('popstate', () => this.onPop());
  }

  private onPresent(event: Event): void {
    const id = this.nextId++;
    (event.target as HTMLElement | null)?.setAttribute('data-ct-back-id', String(id));
    this.marks.push(id);
    history.pushState({ ctModal: id }, '', location.href);
  }

  private onDismiss(event: Event): void {
    if (this.closingByBack > 0) {
      this.closingByBack--;
      return;
    }
    const id = Number((event.target as HTMLElement | null)?.getAttribute('data-ct-back-id'));
    const index = this.marks.indexOf(id);
    if (index < 0) return;
    this.marks.splice(index, 1);
    // Fechou pelo botão: a entrada que guardámos sai, se ainda for a de cima (senão deixa-se, sem mexer em nada).
    if (history.state?.ctModal === id) {
      this.ignoredPops++;
      history.back();
    }
  }

  private onPop(): void {
    if (this.ignoredPops > 0) {
      this.ignoredPops--;
      return;
    }
    if (this.marks.length) {
      this.marks.pop();
      this.closingByBack++;
      void this.modals.getTop().then((modal) => {
        if (modal) void modal.dismiss(undefined, 'back');
        else this.closingByBack--;
      });
      return;
    }
    // Voltou o sistema (e não a nossa seta): ele já animou, por isso a app muda de página sem animação.
    if (this.history.ownBack) this.history.ownBack = false;
    else this.nav.setDirection('back', false);
  }
}
