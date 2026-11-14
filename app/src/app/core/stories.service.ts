import { Injectable, signal } from '@angular/core';
import { readSeen, writeSeen } from './stories.logic';

/** Que viagens já se viram nas histórias do Início (o anel fica cinzento). Fica guardado no telemóvel. */
@Injectable({ providedIn: 'root' })
export class StoriesService {
  private readonly seen = signal<ReadonlySet<string>>(readSeen());

  isSeen(tripId: string): boolean {
    return this.seen().has(tripId);
  }

  markSeen(tripId: string): void {
    if (this.seen().has(tripId)) return;
    const next = new Set(this.seen());
    next.add(tripId);
    this.seen.set(next);
    writeSeen(next);
  }
}
