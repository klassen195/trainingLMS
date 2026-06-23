type MissingProfileSetupProps = {
  userId: string;
};

export function MissingProfileSetup({ userId }: MissingProfileSetupProps) {
  return (
    <main className="flex min-h-screen flex-1 flex-col justify-center px-4 py-6 sm:px-6">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-lg font-semibold">Profile setup required</h1>
        <p className="mt-2 text-sm text-gray-600">
          You are signed in, but no <code className="rounded bg-gray-100 px-1">profiles</code> row exists yet. This
          usually happens if you signed in before running the database migration.
        </p>

        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-gray-700">
          <li>
            Run the migration in Supabase if you have not already (
            <code className="rounded bg-gray-100 px-1">supabase/migrations/20260623120000_training_lms_schema.sql</code>
            )
          </li>
          <li>
            Then run this once in the Supabase <strong>SQL Editor</strong>:
          </li>
        </ol>

        <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs text-zinc-800">
          {`insert into public.profiles (id, display_name)
select id, split_part(email, '@', 1)
from auth.users
where id = '${userId}';`}
        </pre>

        <p className="mt-4 text-xs text-gray-500">Refresh this page after running the SQL.</p>
      </div>
    </main>
  );
}
