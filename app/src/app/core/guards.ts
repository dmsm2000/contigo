import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Só deixa passar quem tem sessão; os outros vão para o ecrã de entrada. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready;
  return auth.session() ? true : router.createUrlTree(['/login']);
};

/** O ecrã de entrada não faz sentido para quem já entrou. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready;
  return auth.session() ? router.createUrlTree(['/home']) : true;
};
