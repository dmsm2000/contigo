import { AfterViewInit, Component, ElementRef, OnDestroy, computed, inject, input, model, signal, viewChild } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { locationOutline, searchOutline, starOutline } from 'ionicons/icons';
import { GeocoderService, PlaceCandidate } from '../../core/geocoder';
import { LanguageService } from '../../core/language.service';
import { initialOf, placeSubtitle, tileColors } from '../../core/trips.logic';

/**
 * Escolher um sítio: pesquisa enquanto se escreve e mostra o que encontra. Deixa sempre guardar só o nome,
 * para um serviço em baixo não bloquear ninguém. Usa-se com `[(place)]="..."`.
 */
@Component({
  selector: 'app-place-picker',
  imports: [IonIcon, TranslocoPipe],
  templateUrl: './place-picker.component.html',
  styleUrl: './place-picker.component.scss',
})
export class PlacePickerComponent implements AfterViewInit, OnDestroy {
  private readonly geocoder = inject(GeocoderService);
  private readonly language = inject(LanguageService).language;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** O sítio escolhido. */
  readonly place = model<PlaceCandidate | null>(null);
  /** A chave de tradução da pergunta ("Onde foram?", "Onde querem ir?"). */
  readonly labelKey = input('trip.form.where');
  readonly inputId = input('place-search');
  /** Abre o teclado logo que o ecrã aparece. */
  readonly autofocus = input(false);

  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private searchRequest: AbortController | undefined;
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('search');

  protected readonly query = signal('');
  protected readonly results = signal<PlaceCandidate[]>([]);
  protected readonly searching = signal(false);
  protected readonly searched = signal(false);
  protected readonly searchFailed = signal(false);
  /** A lista aberta por baixo do campo: fecha ao escolher, com Esc e quando o foco sai do seletor. */
  protected readonly open = signal(false);
  /** O que foi escrito, se der para guardar só com o nome. */
  protected readonly typed = computed(() => {
    const name = this.query().trim();
    return name.length >= 2 ? name : null;
  });

  constructor() {
    addIcons({ locationOutline, searchOutline, starOutline });
  }

  ngAfterViewInit(): void {
    // Espera a animação de entrada do ecrã acabar antes de abrir o teclado.
    if (this.autofocus()) setTimeout(() => this.searchInput()?.nativeElement.focus(), 450);
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
    this.searchRequest?.abort();
  }

  protected onFocusOut(event: FocusEvent): void {
    // Tocar num resultado tira o foco do campo mas continua dentro do seletor: só fecha quando o foco sai mesmo.
    if (!this.host.nativeElement.contains(event.relatedTarget as Node | null)) this.open.set(false);
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.open()) {
      event.stopPropagation();
      this.open.set(false);
    }
  }

  protected onQuery(value: string): void {
    this.open.set(true);
    this.query.set(value);
    clearTimeout(this.searchTimer);
    this.searchRequest?.abort();

    const text = value.trim();
    this.searched.set(false);
    this.searchFailed.set(false);
    if (text.length < 2) {
      this.results.set([]);
      this.searching.set(false);
      return;
    }
    // Só pesquisa quando se pára de escrever.
    this.searching.set(true);
    this.searchTimer = setTimeout(() => void this.runSearch(text), 350);
  }

  private async runSearch(text: string): Promise<void> {
    const request = new AbortController();
    this.searchRequest = request;
    try {
      const found = await this.geocoder.search(text, this.language(), request.signal);
      if (request.signal.aborted) return;
      this.results.set(found);
    } catch {
      if (request.signal.aborted) return;
      this.results.set([]);
      this.searchFailed.set(true);
    } finally {
      if (!request.signal.aborted) {
        this.searching.set(false);
        this.searched.set(true);
      }
    }
  }

  protected choose(candidate: PlaceCandidate): void {
    this.place.set(candidate);
    this.open.set(false);
    this.results.set([]);
    this.query.set('');
  }

  protected chooseTyped(name: string): void {
    this.choose({ osmRef: null, name, admin1: null, countryCode: null, lat: null, lng: null });
  }

  protected change(): void {
    this.place.set(null);
    setTimeout(() => this.searchInput()?.nativeElement.focus(), 50);
  }

  protected subtitle(place: PlaceCandidate): string {
    return placeSubtitle(place, this.language());
  }

  protected tile(place: PlaceCandidate): string {
    const { from, to } = tileColors(place.name);
    return `linear-gradient(135deg, ${from}, ${to})`;
  }

  protected initial(place: PlaceCandidate): string {
    return initialOf(place.name);
  }
}
