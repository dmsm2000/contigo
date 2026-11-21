import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { authStorageKey } from './auth-session.logic';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  /** Onde a sessão fica guardada no browser (o AuthService lê-a daí quando não há rede). */
  readonly storageKey = authStorageKey(environment.supabaseUrl);

  readonly client: SupabaseClient = createClient(environment.supabaseUrl, environment.supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: this.storageKey,
    },
  });
}
