// Initialize Supabase Client
// Please replace these with your actual Supabase URL and Anon Key from the Supabase Dashboard.
// NEVER commit your real secret keys to GitHub!

const supabaseUrl = 'https://replace-with-your-project.supabase.co'; 
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';

// We wrap this in a try/catch so the app doesn't crash if the URL is invalid
let supabaseClient;
try {
  supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
} catch (e) {
  console.warn("Supabase not configured yet.");
}

export const supabase = supabaseClient;
