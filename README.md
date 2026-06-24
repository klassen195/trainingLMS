# TrainingLMS (Supabase + Next.js)

Internal fire department learning management system for program enrollment, modules, and role-based access.

## What's included

- Next.js App Router UI with fire department branding
- Supabase Auth (email magic link) — login required
- SQL migration with RLS, profile bootstrap trigger, and seed catalog programs
- Roles: learner, instructor, admin

## Setup

### 1) Create a Supabase project

- Enable **Email** auth provider
- Configure **Site URL / Redirect URLs** for magic-link return to your app (e.g. `http://localhost:3000/dashboard`)

### 2) Environment variables

Copy `.env.example` to `.env`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### 3) Apply the database migration

Migration files:

- `supabase/migrations/20260623120000_training_lms_schema.sql` (fresh install)
- `supabase/migrations/20260623210000_programs_modules_no_assignments.sql` (upgrade existing DB)

Apply via Supabase CLI (`supabase db push`) or paste into the Supabase SQL editor and run.

### 4) Run the app

```bash
npm run dev
```

Open `http://localhost:3000`.

### 5) Promote your first admin (optional)

After signing in once (creates your profile), run in SQL editor:

```sql
update public.profiles set role = 'admin' where id = '<your-auth-user-uuid>';
```

## Manual QA checklist

1. Sign in with magic link.
2. Browse **Programs** and enroll in a seed program.
3. Open a module and mark it complete.
4. As instructor/admin, create and publish a program with modules.
5. As admin, change a user's role on **Admin**.
