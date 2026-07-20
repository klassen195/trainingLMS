import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export function ShiftExchangeDatabaseSetup() {
  return (
    <div className="container mx-auto max-w-lg px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Database setup required</CardTitle>
          <CardDescription>
            Supabase is connected, but the <code className="rounded bg-muted px-1">shift_exchange_requests</code>{" "}
            table does not exist yet. Run the migration once, then refresh this page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Open your Supabase project → <strong className="text-foreground">SQL Editor</strong> →{" "}
              <strong className="text-foreground">New query</strong>
            </li>
            <li>
              Paste the full contents of{" "}
              <code className="rounded bg-muted px-1">
                supabase/migrations/20260720120000_shift_exchange_requests.sql
              </code>
            </li>
            <li>
              Click <strong className="text-foreground">Run</strong>
            </li>
            <li>Refresh this page</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
