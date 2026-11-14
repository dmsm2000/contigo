import { computed, Injectable, signal } from '@angular/core';
import { readStored, writeStored } from './storage';

/** Quantos segundos dura cada ecrã de uma história. */
export const STORY_SECONDS = ['3', '5', '8', '12'] as const;
export type StorySeconds = (typeof STORY_SECONDS)[number];

const STORY_KEY = 'contigo.storySeconds';
export const TRIPS_VIEWS = ['feed', 'grid'] as const;
export type TripsView = (typeof TRIPS_VIEWS)[number];
const VIEW_KEY = 'contigo.tripsView';

/** Preferências da app que valem só neste telemóvel (as que são de cada pessoa, como a dotação, vivem no perfil). */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly storySeconds = signal<StorySeconds>(readStored(STORY_KEY, STORY_SECONDS, '5'));
  readonly storyMs = computed(() => Number(this.storySeconds()) * 1000);

  /** Como se vê a página Viagens: como um feed (por defeito) ou numa grelha. */
  readonly tripsView = signal<TripsView>(readStored(VIEW_KEY, TRIPS_VIEWS, 'feed'));

  setTripsView(view: TripsView): void {
    this.tripsView.set(view);
    writeStored(VIEW_KEY, view);
  }

  setStorySeconds(value: StorySeconds): void {
    this.storySeconds.set(value);
    writeStored(STORY_KEY, value);
  }
}
