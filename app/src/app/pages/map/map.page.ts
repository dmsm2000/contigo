import { Component, ElementRef, NgZone, OnDestroy, AfterViewInit, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { add, closeOutline, heartOutline, locationSharp, scanOutline } from 'ionicons/icons';
import { LngLatBounds, Map as MapLibreMap, Marker, setWorkerUrl } from 'maplibre-gl';
import { boundsOf, curve, LngLat, MapPin, pinsFromTrips } from '../../core/map.logic';
import { ThemeService } from '../../core/theme.service';
import { LanguageService } from '../../core/language.service';
import { placeSubtitle } from '../../core/trips.logic';
import { TripsService } from '../../core/trips.service';
import { averageStars, nearestOrigin, WishlistItem, WishPin, wishPins } from '../../core/wishlist.logic';
import { WishlistService } from '../../core/wishlist.service';
import { TripFlowService } from '../../features/trips/trip-flow.service';
import { StarsComponent } from '../../features/wishlist/stars.component';

// Estilos de mapa gratuitos do CARTO (dados do OpenStreetMap): um claro e um escuro.
const STYLE_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// Onde cada um de nós mora: as duas pontas da "raia".
const HOMES: readonly { name: string; at: LngLat }[] = [
  { name: 'Porto', at: [-8.611, 41.1496] },
  { name: 'Madrid', at: [-3.7038, 40.4168] },
];

const IBERIA: LngLat = [-5.5, 40.2];

@Component({
  selector: 'app-map',
  imports: [IonContent, IonIcon, RouterLink, TranslocoPipe, StarsComponent],
  templateUrl: './map.page.html',
  styleUrl: './map.page.scss',
})
export class MapPage implements AfterViewInit, OnDestroy {
  private readonly zone = inject(NgZone);
  private readonly theme = inject(ThemeService);
  private readonly flow = inject(TripFlowService);
  private readonly language = inject(LanguageService).language;
  protected readonly trips = inject(TripsService);
  protected readonly wishlist = inject(WishlistService);

  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('map');
  private map: MapLibreMap | undefined;
  private mapStyleIsDark: boolean | undefined;
  private resizeObserver: ResizeObserver | undefined;
  private readonly pinMarkers = new Map<string, Marker>();
  /** Os pins por ir, com o que os desenhou: só se refazem quando mudam. */
  private readonly wishMarkers = new Map<string, { marker: Marker; signature: string }>();
  private homeMarkers: Marker[] = [];
  private fitted = false;

  protected readonly summary = computed(() => pinsFromTrips(this.trips.done()));
  protected readonly visited = computed(() => this.summary().pins.length + this.summary().withoutLocation);
  protected readonly failed = signal(false);

  // Que pins se veem: os sítios onde já fomos e os que estão na lista "Por ir".
  protected readonly showVisited = signal(true);
  protected readonly showWishes = signal(true);
  private readonly wishPinList = computed(() =>
    wishPins(this.wishlist.items(), new Set(this.trips.done().map((trip) => trip.placeId))),
  );
  private readonly visiblePins = computed(() => (this.showVisited() ? this.summary().pins : []));
  private readonly visibleWishPins = computed(() => (this.showWishes() ? this.wishPinList() : []));
  /** O sítio por ir em que se tocou: abre um cartão em baixo. */
  protected readonly selectedWish = signal<WishlistItem | null>(null);
  protected readonly empty = computed(
    () => this.trips.loaded() && this.wishlist.loaded() && !this.trips.done().length && !this.wishlist.items().length,
  );

  constructor() {
    addIcons({ add, closeOutline, heartOutline, locationSharp, scanOutline });

    // O mapa muda de estilo quando a app muda entre claro e escuro.
    effect(() => {
      const dark = this.theme.isDark();
      untracked(() => this.applyStyle(dark));
    });

    // Os pins acompanham as viagens e a lista: aparecem, mudam e desaparecem sozinhos.
    effect(() => {
      const pins = this.visiblePins();
      const wishes = this.visibleWishPins();
      const ready = this.trips.loaded() && (this.wishlist.loaded() || this.wishlist.loadFailed());
      untracked(() => {
        this.syncPins(pins);
        this.syncWishPins(wishes);
        // Enquadra uma vez, quando tudo chega; depois não mexe na câmara do utilizador.
        if (ready && !this.fitted && this.map) {
          this.fitted = true;
          this.fit(false);
        }
      });
    });

    // Se o sítio selecionado sai da lista, o cartão fecha.
    effect(() => {
      const selected = this.selectedWish();
      const items = this.wishlist.items();
      if (selected && !items.some((item) => item.place.id === selected.place.id)) {
        untracked(() => this.selectedWish.set(null));
      }
    });
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      try {
        this.createMap();
      } catch {
        // Sem WebGL (ou bloqueado) não há mapa: mostra-se uma mensagem em vez de um ecrã vazio.
        this.zone.run(() => this.failed.set(true));
      }
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
  }

  /** O Ionic guarda os separadores; ao voltar a este, o mapa pode ter ficado com o tamanho errado. */
  ionViewDidEnter(): void {
    this.map?.resize();
  }

  protected recenter(): void {
    this.fit(true);
  }

  protected addTrip(): void {
    void this.flow.openPastTrip();
  }

  protected addWish(): void {
    void this.flow.openAddWish();
  }

  protected closeWish(): void {
    this.selectedWish.set(null);
  }

  protected wishStars(item: WishlistItem): number {
    return averageStars(item);
  }

  protected wishWhere(item: WishlistItem): string {
    return placeSubtitle(item.place, this.language());
  }

  protected wishDistance(item: WishlistItem): { origin: string; km: number } | null {
    const { lat, lng } = item.place;
    return lat !== null && lng !== null ? nearestOrigin([lng, lat]) : null;
  }

  private createMap(): void {
    // O worker do MapLibre é copiado para `maplibre/` na compilação (angular.json). O endereço tem de ser
    // absoluto e relativo à base da app, que no GitHub Pages é uma subpasta.
    setWorkerUrl(new URL('maplibre/maplibre-gl-worker.mjs', document.baseURI).href);

    const dark = this.theme.isDark();
    const map = new MapLibreMap({
      container: this.container().nativeElement,
      style: dark ? STYLE_DARK : STYLE_LIGHT,
      center: IBERIA,
      zoom: 5,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    this.map = map;
    this.mapStyleIsDark = dark;

    map.on('style.load', () => this.addRaia());
    map.on('load', () => {
      this.addHomes();
      this.syncPins(this.visiblePins());
      this.syncWishPins(this.visibleWishPins());
      if (this.trips.loaded() && (this.wishlist.loaded() || this.wishlist.loadFailed())) {
        this.fitted = true;
        this.fit(false);
      }
    });
    // Tocar no mapa (fora dos pins) fecha o cartão do sítio por ir.
    map.on('click', () => this.zone.run(() => this.selectedWish.set(null)));

    // Em computador, o painel lateral muda o tamanho do mapa.
    this.resizeObserver = new ResizeObserver(() => map.resize());
    this.resizeObserver.observe(this.container().nativeElement);
  }

  private applyStyle(dark: boolean): void {
    if (!this.map || this.mapStyleIsDark === dark) return;
    this.mapStyleIsDark = dark;
    this.map.setStyle(dark ? STYLE_DARK : STYLE_LIGHT);
  }

  /** A linha a tracejado entre o Porto e Madrid. Volta a ser desenhada sempre que o estilo muda. */
  private addRaia(): void {
    const map = this.map;
    if (!map || map.getSource('raia')) return;
    map.addSource('raia', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: curve(HOMES[0].at, HOMES[1].at) },
      },
    });
    map.addLayer({
      id: 'raia',
      type: 'line',
      source: 'raia',
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': '#C2306F', 'line-width': 2.5, 'line-opacity': 0.9, 'line-dasharray': [1.5, 2] },
    });
  }

  private addHomes(): void {
    const map = this.map;
    if (!map || this.homeMarkers.length) return;
    this.homeMarkers = HOMES.map((home) => {
      const element = document.createElement('div');
      element.className = 'ct-home-pin';
      element.innerHTML =
        '<span class="ct-home-pin__dot" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/></svg></span>' +
        `<span class="ct-home-pin__label">${home.name}</span>`;
      return new Marker({ element, anchor: 'center' }).setLngLat(home.at).addTo(map);
    });
  }

  private syncPins(pins: readonly MapPin[]): void {
    const map = this.map;
    if (!map) return;

    const wanted = new Set(pins.map((pin) => pin.placeId));
    for (const [placeId, marker] of this.pinMarkers) {
      if (!wanted.has(placeId)) {
        marker.remove();
        this.pinMarkers.delete(placeId);
      }
    }

    for (const pin of pins) {
      this.pinMarkers.get(pin.placeId)?.remove();
      this.pinMarkers.set(pin.placeId, this.createPin(pin, map));
    }
  }

  private createPin(pin: MapPin, map: MapLibreMap): Marker {
    // O elemento de fora é do MapLibre (ele move-o); o botão de dentro é nosso.
    const element = document.createElement('div');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ct-pin';
    button.style.background = `linear-gradient(135deg, ${pin.colors.from}, ${pin.colors.to})`;
    button.setAttribute('aria-label', pin.name);
    button.textContent = pin.initial;
    if (pin.trips > 1) {
      const count = document.createElement('span');
      count.className = 'ct-pin__count';
      count.textContent = String(pin.trips);
      button.append(count);
    }
    const label = document.createElement('span');
    label.className = 'ct-pin__label';
    label.textContent = pin.name;
    element.append(button, label);

    button.addEventListener('click', (event) => {
      event.stopPropagation();
      this.zone.run(() => void this.flow.openDetail(pin.latestTripId));
    });
    return new Marker({ element, anchor: 'center' }).setLngLat([pin.lng, pin.lat]).addTo(map);
  }

  private syncWishPins(pins: readonly WishPin[]): void {
    const map = this.map;
    if (!map) return;

    const wanted = new Set(pins.map((pin) => pin.placeId));
    for (const [placeId, entry] of this.wishMarkers) {
      if (!wanted.has(placeId)) {
        entry.marker.remove();
        this.wishMarkers.delete(placeId);
      }
    }

    for (const pin of pins) {
      const signature = `${pin.name}|${pin.lng}|${pin.lat}`;
      const existing = this.wishMarkers.get(pin.placeId);
      if (existing?.signature === signature) continue;
      existing?.marker.remove();
      this.wishMarkers.set(pin.placeId, { marker: this.createWishPin(pin, map), signature });
    }
  }

  /** Um sítio por ir: o mesmo pin, mas só com o contorno, para se ver logo que ainda não fomos. */
  private createWishPin(pin: WishPin, map: MapLibreMap): Marker {
    const element = document.createElement('div');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ct-pin ct-pin--wish';
    button.style.setProperty('--pin-color', pin.colors.from);
    button.setAttribute('aria-label', pin.name);
    button.textContent = pin.initial;
    const label = document.createElement('span');
    label.className = 'ct-pin__label';
    label.textContent = pin.name;
    element.append(button, label);

    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const item = this.wishlist.items().find((candidate) => candidate.place.id === pin.placeId) ?? null;
      this.zone.run(() => this.selectedWish.set(item));
    });
    return new Marker({ element, anchor: 'center' }).setLngLat([pin.lng, pin.lat]).addTo(map);
  }

  /** Enquadra os pins; sem pins, enquadra o Porto e Madrid. */
  private fit(animate: boolean): void {
    const map = this.map;
    if (!map) return;
    const pins = [...this.visiblePins(), ...this.visibleWishPins()];
    const points: LngLat[] = pins.length ? pins.map((pin) => [pin.lng, pin.lat]) : HOMES.map((home) => home.at);
    const box = boundsOf(points);
    if (!box) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.fitBounds(new LngLatBounds(box[0], box[1]), {
      padding: { top: 90, bottom: 80, left: 50, right: 50 },
      maxZoom: pins.length ? 9.5 : 6.5,
      duration: animate && !reduceMotion ? 900 : 0,
    });
  }
}
