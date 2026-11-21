import { Injectable, signal } from '@angular/core';
import { DOC_CACHE } from './offline-store';

/** A chave de um ficheiro na cache: um endereço só para isso (nunca é pedido à rede). */
function keyOf(id: string): string {
  return `/offline-docs/${id}`;
}

/**
 * Os ficheiros da viagem (bilhetes, reservas…) guardados no telemóvel, para abrirem sem rede.
 * Usa a Cache API, que o browser mantém fora da memória da página.
 */
@Injectable({ providedIn: 'root' })
export class DocCacheService {
  private readonly idsState = signal<ReadonlySet<string>>(new Set());
  private persistAsked = false;

  /** Os ids dos documentos que já estão guardados. */
  readonly ids = this.idsState.asReadonly();

  constructor() {
    void this.sync();
  }

  has(id: string): boolean {
    return this.idsState().has(id);
  }

  /** O ficheiro guardado, ou nulo se não está. */
  async get(id: string): Promise<Blob | null> {
    try {
      const cache = await this.cache();
      const hit = await cache?.match(keyOf(id));
      return hit ? await hit.blob() : null;
    } catch {
      return null;
    }
  }

  /** Guarda o ficheiro. Devolve falso se não coube ou se o browser não tem onde guardar. */
  async save(id: string, blob: Blob, mime: string): Promise<boolean> {
    try {
      const cache = await this.cache();
      if (!cache) return false;
      await cache.put(keyOf(id), new Response(blob, { headers: { 'content-type': mime } }));
      this.idsState.update((ids) => new Set(ids).add(id));
      this.askToKeep();
      return true;
    } catch {
      return false;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await (await this.cache())?.delete(keyOf(id));
    } catch {
      // Se não se conseguiu apagar, o ficheiro fica até à próxima limpeza.
    }
    this.idsState.update((ids) => new Set([...ids].filter((item) => item !== id)));
  }

  /** Larga os ficheiros de documentos que já não existem (apagados por qualquer um dos dois). */
  async prune(keep: Iterable<string>): Promise<void> {
    const wanted = new Set(keep);
    for (const id of [...this.idsState()]) {
      if (!wanted.has(id)) await this.remove(id);
    }
  }

  /** Lê da cache quais são os ficheiros guardados (a cache sobrevive a fechar a app). */
  private async sync(): Promise<void> {
    try {
      const cache = await this.cache();
      const keys = (await cache?.keys()) ?? [];
      const ids = keys
        .map((request) => new URL(request.url).pathname.split('/').pop() ?? '')
        .filter(Boolean);
      this.idsState.set(new Set(ids));
    } catch {
      // Sem cache, não há nada guardado.
    }
  }

  private async cache(): Promise<Cache | null> {
    return typeof caches === 'undefined' ? null : caches.open(DOC_CACHE);
  }

  /** Pede ao browser para não apagar o que guardámos quando houver pouco espaço (uma só vez; pode ser recusado). */
  private askToKeep(): void {
    if (this.persistAsked) return;
    this.persistAsked = true;
    void navigator.storage?.persist?.().catch(() => undefined);
  }
}
