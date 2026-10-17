# FocusFlow Daily Task Tracker PWA

FocusFlow is a mobile/iPad-first Progressive Web Application (PWA) built to help you track habits and routines daily. Built utilizing Next.js (App Router), TypeScript, Tailwind CSS, recharts, and Supabase (Auth + RLS Protected Postgres database).

---

## Key Features

1. **Weekly Routine Grid (Home)**: sticky habit column, week navigation and date picker, instant check-ins (React `useOptimistic`, rolled back if a save fails), streak badges, categories, archive/restore, and a mobile card view.
2. **History**: month view of every habit with CSV export.
3. **Analytics**: current and longest streaks (computed over full history in the database), completion rates that only count days a habit existed, a 6-month heatmap and weekday insights.
4. **Sharing**: share a habit by email; each person keeps their own check-ins and sees partners' progress.
5. **AI assistant** (Groq): natural-language/voice check-ins, goal → micro-habit breakdown, coaching and a weekly report based on your real numbers.
6. **Offline & installable (PWA)**: check-ins made offline are queued on the device and synced on reconnect; a hand-written service worker (`public/sw.js`) caches only static assets, never user data.
7. **Security**: Row Level Security on every table, an authenticated and rate-limited AI endpoint, and a strict Content Security Policy.

---

## Technical Stack

- **Framework**: Next.js 16 (App Router) + TypeScript + React 19
- **Database + Auth**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS v4
- **Metrics Charting**: Recharts
- **AI**: Groq (OpenAI-compatible API), validated with Zod
- **PWA Service Worker**: custom `public/sw.js`
- **Tests**: Vitest + Testing Library

---

## Local Setup Instructions

### 1. Database (Supabase)
Create a project on the [Supabase Dashboard](https://supabase.com/), open the **SQL Editor**, paste the contents of [`supabase/schema.sql`](./supabase/schema.sql) and click **Run**.

The script is idempotent: it creates everything on a fresh project and upgrades an existing database (including ones set up with the old multi-file migrations) to the current schema. Re-run it whenever it changes.

> **Sharing model:** a shared habit has one check-in per person per day. Everyone the habit is shared with sees each other's progress (read-only badge), but can only tick, untick or delete their own check-ins. Streaks, History and Analytics count only your own. Only the owner can rename, share, archive, delete or reorder a habit.

### 2. Match Env Configurations
Make sure to create/edit `.env` or `.env.local` inside the root workspace folder:

```bash
# Supabase credentials (retrieved from Project Settings -> API in Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-api-key-here

# Groq API key for AI features (server-only — never prefix with NEXT_PUBLIC_)
GROQ_API_KEY=your-groq-api-key-here

# Optional: pin a Groq model. By default the best available chat model is picked automatically.
# GROQ_MODEL=openai/gpt-oss-120b
```

### 3. Run Development Server
Install assets and boot up the Next.js compiler locally:

```bash
# Install dependencies (only required on fresh pulls)
npm install

# Build client and run server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser or mobile emulator inspect tool to view the landing screen.

### 4. Run Tests

```bash
npm test            # run once
npm run test:watch  # re-run on change
```

Unit tests cover the streak, offline-queue, entry, CSV, category and AI-schema logic in `lib/`. Component tests render the tracker, history and analytics views against an in-memory Supabase fake (`tests/helpers/fakeSupabase.ts`).

---

## Project Structure

- `app/` — routes. Dashboard pages are Server Components that resolve the user and render a client view.
- `components/tracker/` — Weekly Tracker (`WeeklyTracker.tsx` holds state; header, grid, mobile cards and dialogs are separate components).
- `components/history/`, `components/analytics/` — History and Analytics views.
- `hooks/` — `useOfflineSync`, `useStreaks`, `useReminders`.
- `lib/` — shared types, pure logic (streaks, entries, offline queue, CSV, categories), AI schemas, Supabase clients.
- `lib/database.types.ts` — database types; regenerate after schema changes with `npx supabase gen types typescript --project-id <ref> > lib/database.types.ts`.
- `supabase/schema.sql` — the whole database schema (tables, RLS policies, functions) in one re-runnable script.

---

## Vercel Deployment

Deploying FocusFlow to Vercel takes only a minute:
1. Connect your repository to Vercel.
2. Add your environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GROQ_API_KEY` (and optionally `GROQ_MODEL`)
3. In Supabase → Authentication → Providers → Email, keep **Confirm email** enabled (sharing matches users by email).
4. Click **Deploy**. Vercel automatically runs `npm run build` and sets up HTTPS SSL/TLS routes.
