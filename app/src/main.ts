import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { AuthService } from './app/core/auth.service';

const SPLASH_MIN_MS = 900;
const splashStart = performance.now();

/** Tira o ecrã de abertura: um mínimo para se ver, e só depois de se saber se há sessão (para não mostrar o login por engano). */
function hideSplash(): void {
  const splash = document.getElementById('splash');
  if (!splash) return;
  const wait = Math.max(0, SPLASH_MIN_MS - (performance.now() - splashStart));
  setTimeout(() => {
    splash.classList.add('out');
    setTimeout(() => splash.remove(), 500);
  }, wait);
}

bootstrapApplication(App, appConfig)
  .then((app) => app.injector.get(AuthService).ready.catch(() => undefined))
  .catch((err) => console.error(err))
  .finally(hideSplash);

// O Safari do iPhone ignora o user-scalable: o gesto de pinça sobre a página (fora do mapa, que usa toques) bloqueia-se aqui.
for (const name of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(name, (event) => event.preventDefault());
}
