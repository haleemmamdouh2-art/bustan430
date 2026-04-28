// Initialize Supabase Client
// Please replace these with your actual Supabase URL and Anon Key from the Supabase Dashboard.
// NEVER commit your real secret keys to GitHub!

const supabaseUrl = 'YOUR_SUPABASE_PROJECT_URL'; 
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';

export const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
