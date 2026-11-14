import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  beforeEach(() => {
    localStorage.removeItem('contigo.storySeconds');
    TestBed.resetTestingModule();
  });

  it('cada ecrã de uma história dura 5 s por defeito', () => {
    const settings = TestBed.inject(SettingsService);
    expect(settings.storySeconds()).toBe('5');
    expect(settings.storyMs()).toBe(5000);
  });

  it('guarda a escolha e lembra-se dela', () => {
    TestBed.inject(SettingsService).setStorySeconds('12');
    TestBed.resetTestingModule();
    expect(TestBed.inject(SettingsService).storyMs()).toBe(12000);
  });

  it('ignora valores guardados que não existem', () => {
    localStorage.setItem('contigo.storySeconds', '99');
    expect(TestBed.inject(SettingsService).storySeconds()).toBe('5');
  });
});
