import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { chevronBackOutline, gridOutline, heart, imagesOutline, playOutline, sparklesOutline, squareOutline } from 'ionicons/icons';
import { SettingsService } from '../../core/settings.service';
import { PhotosService } from '../../core/photos.service';
import { StoriesService } from '../../core/stories.service';
import { byRecentlyAdded, groupByYear, isDone, Trip } from '../../core/trips.logic';
import { TripsService } from '../../core/trips.service';
import { TripPostComponent } from '../../features/trips/trip-post.component';
import { TripFlowService } from '../../features/trips/trip-flow.service';
import { TripLabels } from '../../features/trips/trip-labels.service';

/** Todas as viagens feitas numa grelha, as mais recentes primeiro. */
@Component({
  selector: 'app-trips',
  imports: [IonContent, IonIcon, RouterLink, TranslocoPipe, TripPostComponent],
  templateUrl: './trips.page.html',
  styleUrl: './trips.page.scss',
})
export class TripsPage {
  private readonly flow = inject(TripFlowService);
  protected readonly trips = inject(TripsService);
  protected readonly labels = inject(TripLabels);
  protected readonly stories = inject(StoriesService);

  protected readonly photos = inject(PhotosService);
  protected readonly settings = inject(SettingsService);
  /** O feed vai por data da viagem, a mais recente primeiro. */
  protected readonly feed = computed(() => this.years().flatMap((group) => group.trips));

  /** Para as histórias: pela ordem em que foram registadas. */
  protected readonly all = computed(() => byRecentlyAdded(this.trips.done()));
  /** Na grelha: por ano da viagem. */
  protected readonly years = computed(() => groupByYear(this.trips.done()));
  /** O que ainda vem aí (sorteada, preparada ou a decorrer), a mais próxima primeiro. */
  protected readonly upcoming = computed(() =>
    this.trips
      .trips()
      .filter((trip) => !isDone(trip))
      .sort((a, b) => a.startDate.localeCompare(b.startDate)),
  );

  constructor() {
    addIcons({ chevronBackOutline, gridOutline, squareOutline, heart, imagesOutline, playOutline, sparklesOutline });
  }

  protected open(trip: Trip): void {
    void this.flow.openDetail(trip.id);
  }

  protected toggleView(): void {
    this.settings.setTripsView(this.settings.tripsView() === 'feed' ? 'grid' : 'feed');
  }

  protected playStories(): void {
    void this.flow.openStories(this.all().map((trip) => trip.id), 0);
  }
}
