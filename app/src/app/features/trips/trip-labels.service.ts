import { inject, Injectable } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { LanguageService } from '../../core/language.service';
import { totalOf } from '../../core/expenses.logic';
import { ExpensesService } from '../../core/expenses.service';
import { placeImageUrl } from '../../core/place-image.service';
import { PhotosService } from '../../core/photos.service';
import { ProfileService } from '../../core/profile.service';
import { formatCost, formatTripDate, initialOf, Place, placeSubtitle, tileColors, Trip } from '../../core/trips.logic';

export interface Label {
  key: string;
  params?: Record<string, string>;
}

/**
 * Os textos de uma viagem. Devolve chaves de tradução em vez de texto, para o `transloco` do ecrã
 * os escrever na língua certa e os atualizar quando a língua muda.
 */
@Injectable({ providedIn: 'root' })
export class TripLabels {
  private readonly language = inject(LanguageService).language;
  private readonly profile = inject(ProfileService);
  private readonly auth = inject(AuthService);
  private readonly photos = inject(PhotosService);
  private readonly expenses = inject(ExpensesService);

  date(trip: Trip): string {
    return formatTripDate(trip, this.language());
  }

  where(place: Place): string {
    return placeSubtitle(place, this.language());
  }

  who(trip: Trip): Label {
    if (trip.withPartner) return { key: 'trip.detail.together' };
    if (trip.createdBy && trip.createdBy === this.auth.userId()) return { key: 'trip.detail.onlyMe' };
    const name = this.profile.nameOf(trip.createdBy);
    return name ? { key: 'trip.detail.only', params: { name } } : { key: 'trip.detail.onlyOne' };
  }

  wouldReturn(trip: Trip): Label | null {
    return trip.wouldReturn ? { key: `trip.detail.wouldReturn.${trip.wouldReturn}` } : null;
  }

  /** O que se gastou: a soma das despesas registadas, e só se não houver nenhuma, o valor escrito à mão na viagem. */
  cost(trip: Trip): Label | null {
    const logged = this.expenses.items().filter((item) => item.tripId === trip.id);
    const amount = logged.length ? totalOf(logged) : trip.costEur;
    return amount === null ? null : { key: 'trip.detail.cost', params: { amount: formatCost(amount, this.language()) } };
  }

  initial(place: Place): string {
    return initialOf(place.name);
  }

  /** Se a viagem já tem uma foto para servir de capa (e o link da miniatura já chegou). */
  hasCover(trip: Pick<Trip, 'id' | 'place'>): boolean {
    return this.photos.coverThumbUrl(trip.id) !== null || this.hasPlaceImage(trip.place);
  }

  /** Se o sítio tem imagem guardada (então a "capa" já tem uma foto e não precisa da inicial). */
  hasPlaceImage(place: Pick<Place, 'imagePath'>): boolean {
    return !!place.imagePath;
  }

  /** O fundo da "capa" de uma viagem: a primeira foto, ou as cores do sítio enquanto não há fotos. */
  cover(trip: Pick<Trip, 'id' | 'place'>): string {
    const url = this.photos.coverThumbUrl(trip.id);
    return url ? `center / cover no-repeat url("${url}")` : this.tile(trip.place);
  }

  /** O fundo da "capa" de um sítio: só as cores, para quando não há viagem (por exemplo, a wishlist). */
  tile(place: Place): string {
    const image = placeImageUrl(place.imagePath);
    if (image) return `center / cover no-repeat url("${image}")`;
    const { from, to } = tileColors(place.name);
    return `linear-gradient(135deg, ${from}, ${to})`;
  }
}
