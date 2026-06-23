export function DatabaseSetup() {
  return (
    <main className="flex min-h-screen flex-1 flex-col justify-center px-4 py-6 sm:px-6">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-lg font-semibold">Database setup required</h1>
        <p className="mt-2 text-sm text-gray-600">
          Supabase is connected, but the <code className="rounded bg-gray-100 px-1">profiles</code> table does not
          exist yet. Run the migration once, then refresh this page.
        </p>

        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-gray-700">
          <li>
            Open your Supabase project → <strong>SQL Editor</strong> → <strong>New query</strong>
          </li>
          <li>
            Paste the full contents of
            <code className="rounded bg-gray-100 px-1">supabase/migrations/20260623120000_training_lms_schema.sql</code>
          </li>
          <li>
            Click <strong>Run</strong>
          </li>
          <li>Refresh this page</li>
        </ol>

        <p className="mt-4 text-xs text-gray-500">
          If you already ran the script, wait a few seconds and refresh — Supabase may need a moment to update its
          schema cache.
        </p>
      </div>
    </main>
  );
}
