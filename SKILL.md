# Memory Map (Bustan's Garden)

This is a Vanilla JS web application designed as a "Digital Garden" Memory Map.

## Stack
- Vanilla HTML, CSS, JS
- Leaflet.js (via CDN)
- Supabase JS (via CDN)

## Features
- **Map Engine**: Leaflet with CartoDB Dark Matter tiles.
- **Styling**: Pure CSS with Glassmorphism and CSS particle animations (falling petals).
- **Backend**: Supabase for database (`memories` table) and storage (`memories` bucket).
- **Easter Eggs**:
  1. Pickup Line footer (bottom center heart).
  2. Live Growth vine drawing (right floating button).
  3. Countdown Widget.

## How to Update

If you are an Antigravity agent tasked with modifying this:
1. All map initialization logic is in `main.js`. Custom icons are SVG data URIs in `flowerIcons`.
2. All styling is in `style.css`.
3. To update the database schema, make sure Supabase has a table `memories` with: `id, lat, lng, photo, date, note, type`.
4. Ensure Supabase has a storage bucket named `memories` set to Public.
5. Update the `supabaseUrl` and `supabaseKey` in `supabase.js` to point to a valid Supabase project.

## Running Locally
Since it's Vanilla HTML/JS, you can simply open `index.html` in a browser, or run any static server like `npx serve .` or Live Server in VS Code.
