# FocusFlow Daily Task Tracker PWA

FocusFlow is a mobile/iPad-first Progressive Web Application (PWA) built to help you track habits and routines daily. Built utilizing Next.js (App Router), TypeScript, Tailwind CSS, recharts, and Supabase (Auth + RLS Protected Postgres database).

---

## Key Features

1. **Weekly Routine Grid (Home)**: Focus-first layout with smooth horizontal list scrolling, sticky task column, weekly selectors, date picker, and zero-latency check/uncheck updates powered by React Optimistic UI.
2. **All History monthly log (History)**: Horizontal scroll view containing all completions recorded inside any selected calendar month.
3. **Behavioral Metrics (Analytics)**: Track current consecutive streaks (🔥), longest streaks (🏆), and task completion percentages (%) over selectable intervals (7 Days, 30 Days, Month, 90 Days). Complete with an overall monthly completion trend area chart.
4. **Offline and Installation Support (PWA)**: Desktop/mobile standalone install options + background offline caching configured via `next-pwa`.
5. **Secure RLS Isolation**: Secure Row Level Security (RLS) PostgreSQL constraints ensure authenticated users can only view and update their own database elements.

---

## Technical Stack

- **Framework**: Next.js 16 (App Router) + TypeScript + React 19
- **Database + Auth**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS v4
- **Metrics Charting**: Recharts
- **PWA Service Worker**: next-pwa

---

## Local Setup Instructions

### 1. Database Migrations (Supabase)
Create a new project on your [Supabase Dashboard](https://supabase.com/).
1. Navigate to the **SQL Editor** in the left sidebar.
2. Click **New Query** to create a blank editor worksheet.
3. Open `supabase/schema.sql` from this project repository: [schema.sql](./supabase/schema.sql).
4. Copy-paste the entire contents of `schema.sql` into your Supabase SQL Editor workspace.
5. Click **Run** on the bottom right. This will create:
   - `tasks` and `entries` tables
   - Relational indexes for faster queries
   - Row-level security (RLS) policies targeting `auth.uid() = user_id`

### 2. Match Env Configurations
Make sure to create/edit `.env` or `.env.local` inside the root workspace folder:

```bash
# Supabase credentials (retrieved from Project Settings -> API in Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-api-key-here
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

---

## Vercel Deployment

Deploying FocusFlow to Vercel takes only a minute:
1. Connect your repository to Vercel.
2. Add your environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Click **Deploy**. Vercel automatically runs `npm run build` and sets up HTTPS SSL/TLS routes.
