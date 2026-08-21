"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchActingDepartment } from "@/app/admin/platform-operators/actions";
import { Select } from "@/components/ui/Input";
import type { Client } from "@/lib/clients";

export function DepartmentSwitcher({
  clients,
  actingClientId,
  className,
}: {
  clients: Pick<Client, "id" | "code" | "name" | "is_active">[];
  actingClientId: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const options = clients.filter((client) => client.is_active || client.id === actingClientId);

  return (
    <Select
      aria-label="Department"
      className={className}
      value={actingClientId}
      disabled={pending || options.length === 0}
      onChange={(event) => {
        const clientId = event.target.value;
        if (!clientId || clientId === actingClientId) return;
        startTransition(async () => {
          try {
            await switchActingDepartment(clientId);
            router.refresh();
          } catch (error) {
            window.alert(error instanceof Error ? error.message : "Could not switch department.");
          }
        });
      }}
    >
      {options.map((client) => (
        <option key={client.id} value={client.id}>
          {client.code}
          {client.name ? ` · ${client.name}` : ""}
        </option>
      ))}
    </Select>
  );
}
