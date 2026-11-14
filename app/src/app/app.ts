import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { LanguageService } from './core/language.service';
import { NavigationHistory } from './core/navigation-history.service';
import { ProfileService } from './core/profile.service';
import { ThemeService } from './core/theme.service';
import { UpdateService } from './core/update.service';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet],
  template: `
    <ion-app>
      <ion-router-outlet></ion-router-outlet>
      <!-- Por trás das horas e da bateria na app instalada (ver .ct-status-band em styles.scss). -->
      <div class="ct-status-band" aria-hidden="true"></div>
    </ion-app>
  `,
})
export class App {
  constructor() {
    // Aplica o tema e a língua logo ao arrancar, antes do primeiro ecrã.
    inject(ThemeService);
    inject(LanguageService);
    inject(ProfileService);
    // Procura versões novas ao abrir e sempre que a app volta ao primeiro plano.
    inject(UpdateService);
    // Conta as navegações desde o início, para a seta de voltar saber se há de onde voltar.
    inject(NavigationHistory);
  }
}
