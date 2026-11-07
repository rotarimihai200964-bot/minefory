import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  || '';
const validSupabaseUrl = /^https?:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:\/.*)?$/.test(supabaseUrl);

export const supabaseConfigMissing = !validSupabaseUrl || !supabaseAnonKey;
export const supabase = supabaseConfigMissing
  ? null
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true
      }
    });
