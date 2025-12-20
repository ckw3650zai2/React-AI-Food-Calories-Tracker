import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn("Supabase credentials missing. Authentication features will not work.");
}

// Initialize Supabase Client
// We pass placeholder values if missing to prevent "supabaseUrl is required" error
// which crashes the app on launch. The isSupabaseConfigured flag handles the UI warning.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
);