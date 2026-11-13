import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { LanguageService } from './core/language.service';
import { ProfileService } from './core/profile.service';
import { ThemeService } from './core/theme.service';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet],
  template: `
    <ion-app>
      <ion-router-outlet></ion-router-outlet>
    </ion-app>
  `,
})
export class App {
  constructor() {
    // Aplica o tema e a língua logo ao arrancar, antes do primeiro ecrã.
    inject(ThemeService);
    inject(LanguageService);
    inject(ProfileService);
  }
}
