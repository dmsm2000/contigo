import { computed, Injectable, signal } from '@angular/core';
import { readStored, writeStored } from './storage';

/** Quantos segundos dura cada ecrã de uma história. */
export const STORY_SECONDS = ['3', '5', '8', '12'] as const;
export type StorySeconds = (typeof STORY_SECONDS)[number];

const STORY_KEY = 'contigo.storySeconds';

/** Preferências da app que valem só neste telemóvel (as que são de cada pessoa, como a dotação, vivem no perfil). */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly storySeconds = signal<StorySeconds>(readStored(STORY_KEY, STORY_SECONDS, '5'));
  readonly storyMs = computed(() => Number(this.storySeconds()) * 1000);

  setStorySeconds(value: StorySeconds): void {
    this.storySeconds.set(value);
    writeStored(STORY_KEY, value);
  }
}
