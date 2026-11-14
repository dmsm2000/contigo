import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { chevronBackOutline, playOutline } from 'ionicons/icons';
import { StoriesService } from '../../core/stories.service';
import { byRecentlyAdded, Trip } from '../../core/trips.logic';
import { TripsService } from '../../core/trips.service';
import { TripFlowService } from '../../features/trips/trip-flow.service';
import { TripLabels } from '../../features/trips/trip-labels.service';

/** Todas as viagens feitas numa grelha, as mais recentes primeiro. */
@Component({
  selector: 'app-trips',
  imports: [IonContent, IonIcon, RouterLink, TranslocoPipe],
  templateUrl: './trips.page.html',
  styleUrl: './trips.page.scss',
})
export class TripsPage {
  private readonly flow = inject(TripFlowService);
  protected readonly trips = inject(TripsService);
  protected readonly labels = inject(TripLabels);
  protected readonly stories = inject(StoriesService);

  protected readonly all = computed(() => byRecentlyAdded(this.trips.done()));

  constructor() {
    addIcons({ chevronBackOutline, playOutline });
  }

  protected open(trip: Trip): void {
    void this.flow.openDetail(trip.id);
  }

  protected playStories(): void {
    void this.flow.openStories(this.all().map((trip) => trip.id), 0);
  }
}
