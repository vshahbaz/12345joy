import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
  console.warn('[Supabase] URL:', supabaseUrl ? 'SET' : 'EMPTY');
  console.warn('[Supabase] Key:', supabaseAnonKey ? 'SET' : 'EMPTY');
} else {
  console.log('[Supabase] Configured with URL:', supabaseUrl.substring(0, 30) + '...');
}

export const supabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'implicit',
    lock: (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
      return fn();
    },
  },
  global: {
    fetch: async (url, options) => {
      try {
        return await fetch(url, options);
      } catch (err) {
        console.error('[Supabase] Network fetch failed for:', typeof url === 'string' ? url.split('?')[0] : 'unknown', err instanceof Error ? err.message : err);
        throw err;
      }
    },
  },
});
