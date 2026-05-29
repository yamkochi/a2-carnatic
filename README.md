# Mela Raga Keyboard

This is a Next.js (App Router) JavaScript app with Tailwind CSS that displays a
24-key piano keyboard, a raga selector (from MySQL table `mela_raga`) and plays
notes using WebAudio. It also exposes an API to fetch ragas.

Setup

1. Copy your environment variables into `.env.local` in the project root.
   Example values (DO NOT commit secrets):

```
MYSQL_HOST='127.0.0.1'
MYSQL_USER='root'
MYSQL_PASSWORD='Gyyyyy@1439'
MYSQL_DATABASE='melakeyboard'
MYSQL_PORT='3306'
```

2. Install and run:

```bash
npm install
npm run dev
```

3. Open http://localhost:3000

Notes

- The API route `/api/ragas` reads `id,name,swaram,song_path` from `mela_raga`.
- The piano keyboard plays generated tones in selected waveform (`sine`,
  `square`, `sawtooth`, `triangle`).
- Select a raga in the list to display its `swaram` labels on the keyboard.
  Press keys to hear notes.
