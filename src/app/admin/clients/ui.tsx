"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, updateClient, type ClientWithModules } from "@/app/admin/clients/actions";
import { ClientModulesEditor } from "@/components/ClientModulesEditor";
import { PlatformModuleOrderEditor } from "@/components/PlatformModuleOrderEditor";
import type { PlatformModuleOrderItem } from "@/lib/client-modules";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export function ClientsAdminUi({
  clients,
  masterOrder,
}: {
  clients: ClientWithModules[];
  masterOrder: PlatformModuleOrderItem[];
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rowLoading, setRowLoading] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [modulesOpenId, setModulesOpenId] = useState<string | null>(null);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createClient({ code, name });
      setCode("");
      setName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create client");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(client: ClientWithModules) {
    setError(null);
    setEditingId(client.id);
    setEditCode(client.code);
    setEditName(client.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditCode("");
    setEditName("");
  }

  async function onSave(client: ClientWithModules) {
    setError(null);
    setRowLoading(client.id);
    try {
      await updateClient({
        id: client.id,
        code: editCode,
        name: editName,
        isActive: client.is_active,
      });
      cancelEdit();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update client");
    } finally {
      setRowLoading(null);
    }
  }

  async function onToggleActive(client: ClientWithModules) {
    setError(null);
    setRowLoading(client.id);
    try {
      await updateClient({
        id: client.id,
        name: client.name,
        isActive: !client.is_active,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update client");
    } finally {
      setRowLoading(null);
    }
  }

  return (
    <div className="space-y-8">
      <PlatformModuleOrderEditor items={masterOrder} />

      <Card>
        <CardHeader>
          <CardTitle>Create client</CardTitle>
          <CardDescription>
            Hand out the Client ID code for login. New clients get starter permission levels (Recruit,
            Firefighter, Captain) and inherit the master module order with all modules on.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="client-code">
                Client ID code
              </label>
              <Input
                id="client-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ACMEFD"
                className="uppercase tracking-wide"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="client-name">
                Display name
              </label>
              <Input
                id="client-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Fire Department"
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create client"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clients</CardTitle>
          <CardDescription>
            Edit the display name and Client ID, then open Modules to turn features on/off and set a
            custom order for that client.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clients yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border">
              {clients.map((client) => {
                const isEditing = editingId === client.id;
                const busy = rowLoading === client.id;
                const modulesOpen = modulesOpenId === client.id;
                const enabledCount = client.modules.filter((module) => module.enabled).length;
                return (
                  <li key={client.id} className="space-y-3 px-4 py-3">
                    {isEditing ? (
                      <form
                        className="grid gap-3 sm:grid-cols-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void onSave(client);
                        }}
                      >
                        <div className="space-y-2">
                          <label className="text-sm font-medium" htmlFor={`edit-code-${client.id}`}>
                            Client ID code
                          </label>
                          <Input
                            id={`edit-code-${client.id}`}
                            required
                            value={editCode}
                            onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                            className="uppercase tracking-wide"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium" htmlFor={`edit-name-${client.id}`}>
                            Display name
                          </label>
                          <Input
                            id={`edit-name-${client.id}`}
                            required
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                          />
                        </div>
                        <div className="flex flex-wrap gap-2 sm:col-span-2">
                          <Button type="submit" disabled={busy}>
                            {busy ? "Saving..." : "Save"}
                          </Button>
                          <Button type="button" variant="outline" disabled={busy} onClick={cancelEdit}>
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium tracking-wide">{client.code}</p>
                          <p className="text-sm text-muted-foreground">{client.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {enabledCount}/{client.modules.length} modules on
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={
                              client.is_active
                                ? "text-xs font-medium text-green-700"
                                : "text-xs font-medium text-muted-foreground"
                            }
                          >
                            {client.is_active ? "Active" : "Inactive"}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              setModulesOpenId((current) => (current === client.id ? null : client.id))
                            }
                          >
                            {modulesOpen ? "Hide modules" : "Modules"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => startEdit(client)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => void onToggleActive(client)}
                          >
                            {client.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </div>
                    )}
                    {modulesOpen ? (
                      <ClientModulesEditor
                        clientId={client.id}
                        modules={client.modules}
                        allowToggle
                        title="Client modules"
                        description="Turn modules on or off for this client, then drag to set a custom nav order."
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
