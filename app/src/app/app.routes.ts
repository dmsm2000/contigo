import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shell/shell.page').then((m) => m.ShellPage),
    children: [
      { path: 'home', loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage) },
      { path: 'trips', loadComponent: () => import('./pages/trips/trips.page').then((m) => m.TripsPage) },
      { path: 'map', loadComponent: () => import('./pages/map/map.page').then((m) => m.MapPage) },
      { path: 'wishlist', loadComponent: () => import('./pages/wishlist/wishlist.page').then((m) => m.WishlistPage) },
      { path: 'ideas', loadComponent: () => import('./pages/ideas/ideas.page').then((m) => m.IdeasPage) },
      { path: 'availability', loadComponent: () => import('./pages/dates/dates.page').then((m) => m.DatesPage) },
      { path: 'us', loadComponent: () => import('./pages/us/us.page').then((m) => m.UsPage) },
      { path: '', pathMatch: 'full', redirectTo: 'home' },
    ],
  },
  { path: '**', redirectTo: '' },
];
