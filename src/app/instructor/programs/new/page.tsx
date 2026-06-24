import { requireRole } from "@/lib/auth";
import { NewProgramForm } from "./ui";

export default async function NewProgramPage() {
  await requireRole(["instructor", "admin"]);

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 text-4xl font-bold">Create program</h1>
      <p className="mb-8 text-lg text-muted-foreground">Add a new training program to the catalog.</p>
      <NewProgramForm />
    </div>
  );
}
