import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  ActionSheetController,
  IonContent,
  IonIcon,
  IonLabel,
  IonMenu,
  IonSplitPane,
  IonTabBar,
  IonTabButton,
  IonTabs,
  ToastController,
} from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import {
  add,
  bulbOutline,
  calendarOutline,
  cameraOutline,
  heartOutline,
  homeOutline,
  imagesOutline,
  locationOutline,
  mapOutline,
  moonOutline,
  peopleOutline,
  walletOutline,
} from 'ionicons/icons';
import { ProfileService } from '../core/profile.service';
import { TripsService } from '../core/trips.service';
import { ThemeService } from '../core/theme.service';
import { TripFlowService } from '../features/trips/trip-flow.service';

interface NavItem {
  tab: string;
  icon: string;
  label: string;
}

@Component({
  selector: 'app-shell',
  imports: [
    IonSplitPane,
    IonMenu,
    IonContent,
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonLabel,
    RouterLink,
    RouterLinkActive,
    TranslocoPipe,
  ],
  templateUrl: './shell.page.html',
  styleUrl: './shell.page.scss',
})
export class ShellPage {
  private readonly actionSheets = inject(ActionSheetController);
  private readonly toasts = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly profile = inject(ProfileService);
  private readonly flow = inject(TripFlowService);
  private readonly trips = inject(TripsService);
  protected readonly theme = inject(ThemeService);

  protected readonly sideNav: NavItem[] = [
    { tab: 'home', icon: 'home-outline', label: 'nav.home' },
    { tab: 'map', icon: 'map-outline', label: 'nav.map' },
    { tab: 'wishlist', icon: 'heart-outline', label: 'nav.wishlist' },
    { tab: 'availability', icon: 'calendar-outline', label: 'nav.availability' },
    { tab: 'ideas', icon: 'bulb-outline', label: 'nav.ideas' },
    { tab: 'us', icon: 'people-outline', label: 'nav.us' },
  ];

  constructor() {
    addIcons({
      add,
      bulbOutline,
      calendarOutline,
      cameraOutline,
      heartOutline,
      homeOutline,
      imagesOutline,
      locationOutline,
      mapOutline,
      moonOutline,
      peopleOutline,
      walletOutline,
    });
  }

  protected async openAdd(): Promise<void> {
    const t = (key: string) => this.transloco.translate(key);
    const soon = () => void this.showSoon();
    const sheet = await this.actionSheets.create({
      header: t('add.title'),
      buttons: [
        { text: t('add.pastTrip'), icon: 'images-outline', handler: () => void this.flow.openPastTrip() },
        { text: t('add.photo'), icon: 'camera-outline', handler: () => void this.addPhotos() },
        { text: t('add.expense'), icon: 'wallet-outline', handler: soon },
        { text: t('add.place'), icon: 'location-outline', handler: () => void this.flow.openAddWish() },
        { text: t('add.idea'), icon: 'bulb-outline', handler: () => void this.flow.openIdea() },
        { text: t('common.cancel'), role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  /** Sem nenhuma viagem não há onde pôr as fotos: diz-se como começar. */
  private async addPhotos(): Promise<void> {
    if (this.trips.trips().length) return this.flow.openAddPhotos();
    const toast = await this.toasts.create({
      message: this.transloco.translate('photos.noTrips'),
      duration: 2800,
      position: 'top',
    });
    await toast.present();
  }

  protected toggleTheme(): void {
    void this.profile.setTheme(this.theme.isDark() ? 'light' : 'dark');
  }

  private async showSoon(): Promise<void> {
    const toast = await this.toasts.create({
      message: this.transloco.translate('common.soon'),
      duration: 1800,
      position: 'top',
    });
    await toast.present();
  }
}
