# TrainingLMS (Supabase + Next.js)

Internal fire department learning management system for course enrollment, lessons, assignments, and role-based access.

## What's included

- Next.js App Router UI with fire department branding
- Supabase Auth (email magic link) — login required
- SQL migration with RLS, profile bootstrap trigger, and seed catalog courses
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

Migration file:

- `supabase/migrations/20260623120000_training_lms_schema.sql`

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
2. Browse **Courses** and enroll in a seed course.
3. Open a lesson and mark it complete; submit an assignment.
4. As instructor/admin, create and publish a course with lessons and assignments.
5. As admin, change a user's role on **Admin**.
