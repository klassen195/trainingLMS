# TrainingLMS (Supabase + Next.js)

Internal fire department learning management system for program enrollment, modules, and role-based access — plus a public Shift Exchange tool.

## What's included

- Next.js App Router UI with fire department branding
- Public **Shift Exchange** (no login) at `/shift-exchange`
- Public landing hub at `/`
- Supabase Auth (email magic link) for Training LMS features
- SQL migrations with RLS, profile bootstrap trigger, and seed catalog programs
- Roles: recruit, firefighter, captain — plus system admin flag

## Setup

### 1) Create a Supabase project

- Enable **Email** auth provider
- Configure **Site URL / Redirect URLs** for magic-link return (e.g. `http://localhost:3000/auth/callback`)
- Configure **custom SMTP** so login emails are sent from your domain (see below)

### Email deliverability (avoid spam folder)

Supabase’s built-in email sender is for testing only. Messages often land in spam because they come from a shared Supabase address with no reputation on your domain.

**Recommended:** send auth email through your own `@kootenaifire.com` mail.

1. In Supabase → **Project Settings → Authentication → SMTP Settings**, enable custom SMTP.
2. Use one of these senders:
   - **Microsoft 365** (if your department already uses it): host `smtp.office365.com`, port `587`, user = a dedicated mailbox such as `training-lms@kootenaifire.com`, password = that account’s password or app password. Your IT admin may need to enable SMTP AUTH for the account.
   - **Resend / Postmark / SendGrid**: create an account, verify the `kootenaifire.com` domain (add the DNS records they provide), then paste their SMTP credentials into Supabase.
3. Set **Sender email** to something like `training-lms@kootenaifire.com` and **Sender name** to `Kootenai Fire Training LMS`.
4. In **Authentication → Email Templates**, edit the Magic Link template:
   - Subject: `Sign in to Training LMS` (short, no marketing language)
   - Keep the body simple — one clear link, no extra images or promotional text
5. Confirm SPF, DKIM, and DMARC are configured for the sending domain (your email provider’s docs cover this; Resend/Postmark walk you through it).

Optional but helpful: set a **custom auth domain** in Supabase so magic-link URLs use your domain instead of `*.supabase.co` (Authentication → URL Configuration).

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
- `supabase/migrations/20260720120000_shift_exchange_requests.sql` (Shift Exchange table + open RLS)

Apply via Supabase CLI (`supabase db push`) or paste into the Supabase SQL editor and run.

### 4) Run the app

```bash
npm run dev
```

Open `http://localhost:3000`.

### 5) Promote your first admin (optional)

After signing in once (creates your profile), run in SQL editor:

```sql
update public.profiles
set role = 'captain', is_admin = true
where id = '<your-auth-user-uuid>';
```

## Manual QA checklist

1. Sign in with magic link.
2. Browse **Programs** and enroll in a seed program.
3. Open a module and mark it complete.
4. As captain/admin, create and publish a program with modules.
5. As admin, change a user's permission level on **Admin**.
6. Assign training to a Recruit via SQL (Recruits cannot self-enroll):

```sql
insert into public.module_enrollments (module_id, user_id)
select pm.module_id, '<recruit-user-uuid>'
from public.program_modules pm
where pm.program_id = '<program-uuid>'
on conflict (module_id, user_id) do nothing;
```
