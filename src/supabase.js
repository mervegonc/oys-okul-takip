import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Frontend için (anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Backend/Admin işlemleri için (service role key - RLS bypass)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);