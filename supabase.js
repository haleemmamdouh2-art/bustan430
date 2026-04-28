// Initialize Supabase Client

const supabaseUrl = 'https://byqfgirtizfvbmvrkuts.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5cWZnaXJ0aXpmdmJtdnJrdXRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMjE0MjksImV4cCI6MjA5Mjg5NzQyOX0.KIh1RSlwO0ps4vT4tFBvB4qiamCxLyLhCtUvaVnYUvY';

// We wrap this in a try/catch so the app doesn't crash if the URL is invalid
let supabaseClient;
try {
  supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
} catch (e) {
  console.warn("Supabase not configured yet.");
}

window.supabaseDb = supabaseClient;
