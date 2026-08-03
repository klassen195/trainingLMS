import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/capability-access";
import { listApparatusForIncident, loadIncidentWorkspace } from "@/app/incidents/actions";
import { IncidentWorkspace } from "@/components/incidents/IncidentWorkspace";

export default async function IncidentBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCapability("manage_incidents");
  const { id } = await params;

  let workspace;
  try {
    workspace = await loadIncidentWorkspace(id);
  } catch {
    notFound();
  }

  const apparatus = await listApparatusForIncident();

  return <IncidentWorkspace initial={workspace} apparatusOptions={apparatus} />;
}
