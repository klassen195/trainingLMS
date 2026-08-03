import { Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function PersonnelDatabaseSetup() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <Card>
        <CardHeader>
          <div className="mb-2 flex items-center gap-3">
            <Database className="h-6 w-6 text-primary" />
            <CardTitle>Personnel database setup</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Personnel tables are not available yet. Run the migration in the Supabase SQL editor:
          </p>
          <code className="block rounded-md bg-muted px-3 py-2 text-foreground">
            supabase/migrations/20260729420000_personnel_module.sql
          </code>
        </CardContent>
      </Card>
    </div>
  );
}
