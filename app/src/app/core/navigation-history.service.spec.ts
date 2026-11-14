import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { NavigationHistory } from './navigation-history.service';

@Component({ template: '' })
class Blank {}

function setup() {
  TestBed.configureTestingModule({
    providers: [provideRouter([{ path: 'a', component: Blank }, { path: 'b', component: Blank }, { path: 'home', component: Blank }])],
  });
  return { router: TestBed.inject(Router), history: TestBed.inject(NavigationHistory) };
}

describe('NavigationHistory', () => {
  it('à primeira página não há para onde voltar: vai ao ecrã por defeito', async () => {
    const { router, history } = setup();
    await router.navigateByUrl('/a');
    expect(history.canGoBack).toBe(false);
    history.back('/home');
    await new Promise((resolve) => setTimeout(resolve));
    expect(router.url).toBe('/home');
  });

  it('depois de navegar dentro da app, volta ao ecrã anterior', async () => {
    const { router, history } = setup();
    await router.navigateByUrl('/a');
    await router.navigateByUrl('/b');
    expect(history.canGoBack).toBe(true);
    const back = vi.spyOn(TestBed.inject(Location as never) as { back(): void }, 'back').mockImplementation(() => undefined);
    history.back('/home');
    expect(back).toHaveBeenCalled();
  });
});
