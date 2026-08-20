import { createClient } from '@supabase/supabase-js';

// Geçici olarak değerleri direkt yaz (SADECE TEST İÇİN!)
const supabaseUrl = 'https://ztjdsnwtdmdasclveume.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0amRzbnd0ZG1kYXNjbHZldW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxOTMyODksImV4cCI6MjEwMjc2OTI4OX0.LJw3ezE-n2qBYRuorBPJAMMYFvS0NikP3QeelarOgQ8';
const supabaseServiceRoleKey = 'sb_publishable_LazklBcp_ZUQ8LjC_q6jnw_hMkF555C';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('supabaseUrl or supabaseKey is required. Check your environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);