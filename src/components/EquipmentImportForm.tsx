"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Download, Upload } from "lucide-react";
import { importEquipmentRows } from "@/app/assets/ppe/import/actions";
import {
  EQUIPMENT_IMPORT_TEMPLATE,
  parseEquipmentImportCsv,
  toImportRowInput,
  type EquipmentImportCsvRow,
  type EquipmentImportResult,
} from "@/lib/equipment-import";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldError, FieldHint, FieldLabel } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

export function EquipmentImportForm({
  existingEquipmentIds,
}: {
  existingEquipmentIds: string[];
}) {
  const [rows, setRows] = useState<EquipmentImportCsvRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<EquipmentImportResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const existingSet = useMemo(
    () => new Set(existingEquipmentIds.map((id) => id.trim().toLowerCase())),
    [existingEquipmentIds]
  );

  const preview = useMemo(() => {
    return rows.map((row) => {
      const id = row.equipment_id?.trim() ?? "";
      const action =
        id && existingSet.has(id.toLowerCase()) ? ("update" as const) : ("create" as const);
      return { row, action };
    });
  }, [existingSet, rows]);

  function downloadTemplate() {
    const blob = new Blob([EQUIPMENT_IMPORT_TEMPLATE + "\n"], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "equipment-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function onFileChange(file: File | null) {
    setResult(null);
    setActionError(null);
    setParseError(null);
    setRows([]);
    setFileName(null);
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const parsed = parseEquipmentImportCsv(text);
      if (parsed.error) {
        setParseError(parsed.error);
        return;
      }
      setRows(parsed.rows);
    };
    reader.onerror = () => setParseError("Could not read the selected file.");
    reader.readAsText(file);
  }

  function runImport() {
    setActionError(null);
    setResult(null);
    const payload = rows.map(toImportRowInput);
    startTransition(async () => {
      try {
        const next = await importEquipmentRows(payload);
        setResult(next);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Import failed.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="mr-1.5 h-4 w-4" />
              Download template
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/assets/ppe">Back to inventory</Link>
            </Button>
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="equipment_csv">CSV file</FieldLabel>
            <Input
              id="equipment_csv"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            />
            <FieldHint>
              Required columns: equipment_id, category. Matching equipment_id updates an existing
              item; new IDs are created. Categories, stations, people, and apparatus must already
              exist.
            </FieldHint>
            {fileName ? (
              <p className="text-sm text-muted-foreground">
                Loaded {fileName} · {rows.length} row{rows.length === 1 ? "" : "s"}
              </p>
            ) : null}
            {parseError ? <FieldError>{parseError}</FieldError> : null}
            {actionError ? <FieldError>{actionError}</FieldError> : null}
          </div>

          {rows.length > 0 ? (
            <Button type="button" onClick={runImport} disabled={pending}>
              <Upload className="mr-1.5 h-4 w-4" />
              {pending ? "Importing…" : `Import ${rows.length} row${rows.length === 1 ? "" : "s"}`}
            </Button>
          ) : null}

          {result ? (
            <div className="space-y-2 rounded-md border p-3 text-sm">
              <p>
                Created <strong>{result.created}</strong>, updated{" "}
                <strong>{result.updated}</strong>
                {result.errors.length > 0 ? (
                  <>
                    , <strong>{result.errors.length}</strong> error
                    {result.errors.length === 1 ? "" : "s"}
                  </>
                ) : null}
                .
              </p>
              {result.errors.length > 0 ? (
                <ul className="max-h-48 space-y-1 overflow-y-auto text-destructive">
                  {result.errors.map((err) => (
                    <li key={`${err.row}-${err.message}`}>
                      Row {err.row}
                      {err.equipment_id ? ` (${err.equipment_id})` : ""}: {err.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {preview.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[28rem] overflow-auto rounded-md border">
              <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-1.5 font-medium">Row</th>
                    <th className="px-2 py-1.5 font-medium">Action</th>
                    <th className="px-2 py-1.5 font-medium">Equipment ID</th>
                    <th className="px-2 py-1.5 font-medium">Category</th>
                    <th className="px-2 py-1.5 font-medium">Status</th>
                    <th className="px-2 py-1.5 font-medium">Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map(({ row, action }) => (
                    <tr key={row.rowNumber} className="border-b align-top">
                      <td className="px-2 py-1.5 tabular-nums text-muted-foreground">
                        {row.rowNumber}
                      </td>
                      <td className="px-2 py-1.5">
                        <Badge variant={action === "update" ? "outline" : "secondary"}>
                          {action}
                        </Badge>
                      </td>
                      <td className="px-2 py-1.5 font-medium">{row.equipment_id || "—"}</td>
                      <td className="px-2 py-1.5">{row.category || "—"}</td>
                      <td className="px-2 py-1.5">{row.status || "in_service"}</td>
                      <td className="px-2 py-1.5">
                        {row.assignment_type
                          ? [
                              row.assignment_type,
                              row.assigned_person ||
                                row.assigned_station ||
                                row.assigned_apparatus ||
                                "",
                            ]
                              .filter(Boolean)
                              .join(": ")
                          : "Unassigned"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
