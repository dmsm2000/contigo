import { effect, inject, Injectable, untracked } from '@angular/core';
import { AuthService } from './auth.service';
import { ConnectivityService } from './connectivity.service';
import { DocCacheService } from './doc-cache.service';
import { DrawService } from './draw.service';
import { TripDocsService } from './trip-docs.service';
import { TripDoc } from './trip-docs.logic';

/**
 * Deixa tudo pronto para a viagem sem rede: com rede, guarda no telemóvel os ficheiros (bilhetes, reservas…) da viagem
 * que aí vem, para abrirem mesmo onde não há sinal. Os dados em si (viagem, roteiro, lista de ficheiros) guardam-se
 * nos respetivos serviços. Só se descarrega o que falta, uma vez por ficheiro.
 */
@Injectable({ providedIn: 'root' })
export class OfflineSyncService {
  private readonly auth = inject(AuthService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly docs = inject(TripDocsService);
  private readonly draws = inject(DrawService);
  private readonly saved = inject(DocCacheService);
  private busy = false;

  constructor() {
    effect(() => {
      const trip = this.draws.active();
      const files = trip ? this.docs.docsOf(trip.id) : [];
      const have = this.saved.ids();
      // Lê-se para voltar a tentar quando a rede volta.
      this.connectivity.refresh();
      const online = this.connectivity.online();
      const missing = files.filter((doc) => !have.has(doc.id));
      if (!online || this.auth.stale() || !missing.length || saveData()) return;
      untracked(() => void this.fetchAll(missing));
    });
  }

  /** Um a um, para não gastar a rede toda de uma vez; um que falhe não impede os outros. */
  private async fetchAll(missing: TripDoc[]): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      for (const doc of missing) {
        if (!this.connectivity.online()) break;
        const blob = await this.docs.download(doc).catch(() => null);
        if (blob) await this.saved.save(doc.id, blob, doc.mime);
      }
    } finally {
      this.busy = false;
    }
  }
}

/** Quem ativou a poupança de dados não quer descargas que não pediu. */
function saveData(): boolean {
  return (
    (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
  );
}
