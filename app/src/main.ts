import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));

// O Safari do iPhone ignora o user-scalable: o gesto de pinça sobre a página (fora do mapa, que usa toques) bloqueia-se aqui.
for (const name of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(name, (event) => event.preventDefault());
}
