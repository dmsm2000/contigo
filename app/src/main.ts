import { bootstrapApplication } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter, firstValueFrom, timeout } from 'rxjs';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { AuthService } from './app/core/auth.service';

const SPLASH_MIN_MS = 900;
/** O máximo que se espera pela primeira página, para o ecrã de abertura nunca ficar preso. */
const FIRST_PAGE_MAX_MS = 4000;
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

/** Espera que a primeira página esteja pronta e desenhada: senão o ecrã de abertura sai e fica um ecrã em branco até ela chegar. */
async function firstPageDrawn(router: Router): Promise<void> {
  // `navigated` já é verdadeiro se a primeira navegação acabou entretanto (por exemplo, enquanto se esperava pela sessão).
  if (!router.navigated) await firstValueFrom(router.events.pipe(filter((event) => event instanceof NavigationEnd), timeout(FIRST_PAGE_MAX_MS))).catch(() => undefined);
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

bootstrapApplication(App, appConfig)
  .then(async (app) => {
    await app.injector.get(AuthService).ready.catch(() => undefined);
    await firstPageDrawn(app.injector.get(Router));
  })
  .catch((err) => console.error(err))
  .finally(hideSplash);

// O Safari do iPhone ignora o user-scalable: o gesto de pinça sobre a página (fora do mapa, que usa toques) bloqueia-se aqui.
for (const name of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(name, (event) => event.preventDefault());
}
