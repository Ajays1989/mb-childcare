# Manitoba Childcare Waitlist Tracker (prototype)

Express + React (Vite) + Tailwind + SQLite (Drizzle). Hash routing so it works inside Capacitor web views.

## Routes
- `#/` parent search, add waitlist status, report inaccurate info, flag (report abuse) per wait time
- `#/provider` provider sign-in + dashboard (demo: director@littlemaples.example / demo1234)
- `#/admin-moderation` hidden moderation page (password: env `ADMIN_PASSWORD`, default `manitoba-admin`)
- `#/privacy`, `#/terms`

## Run
npm ci && npm run dev        # http://localhost:5000
npm run build && npm start   # production

## Before launch
- Replace sample centres ("(Sample)") with the Manitoba licensed childcare facility list.
- Swap SQLite + demo password auth for Supabase (Postgres + Supabase Auth email login); tables map 1:1 to `shared/schema.ts`.
- Change ADMIN_PASSWORD, contact email lives in `client/src/lib/contact.ts`, and set real store URLs in `client/src/components/shell.tsx`.
