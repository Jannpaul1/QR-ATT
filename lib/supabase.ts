
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase URL or API key. Check your .env file.'
  );
}

if (!supabaseUrl.startsWith('https://')) {
  throw new Error(
    'Invalid Supabase URL. It must start with https://'
  );
}

if (
  !supabaseAnonKey.startsWith('sb_publishable_') &&
  !supabaseAnonKey.startsWith('eyJ')
) {
  throw new Error(
    'Invalid Supabase API key format. Check your .env file.'
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
