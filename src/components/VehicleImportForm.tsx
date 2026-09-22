"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Download, Upload } from "lucide-react";
import { importVehicleRows } from "@/app/assets/apparatus/import/actions";
import {
  VEHICLE_IMPORT_TEMPLATE,
  parseVehicleImportCsv,
  toVehicleImportRowInput,
  type VehicleImportCsvRow,
  type VehicleImportResult,
} from "@/lib/vehicle-import";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldError, FieldHint, FieldLabel } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

export function VehicleImportForm({
  existingBuildNumbers,
}: {
  existingBuildNumbers: string[];
}) {
  const [rows, setRows] = useState<VehicleImportCsvRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<VehicleImportResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const existingSet = useMemo(
    () => new Set(existingBuildNumbers.map((id) => id.trim().toLowerCase())),
    [existingBuildNumbers]
  );

  const preview = useMemo(() => {
    return rows.map((row) => {
      const build = row.build_number?.trim() ?? "";
      const action =
        build && existingSet.has(build.toLowerCase())
          ? ("update" as const)
          : ("create" as const);
      return { row, action };
    });
  }, [existingSet, rows]);

  function downloadTemplate() {
    const blob = new Blob([VEHICLE_IMPORT_TEMPLATE + "\n"], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vehicle-import-template.csv";
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
      const parsed = parseVehicleImportCsv(text);
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
    const payload = rows.map(toVehicleImportRowInput);
    startTransition(async () => {
      try {
        const next = await importVehicleRows(payload);
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
              <Link href="/assets/apparatus">Back to apparatus</Link>
            </Button>
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="vehicle_csv">CSV file</FieldLabel>
            <Input
              id="vehicle_csv"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            />
            <FieldHint>
              Required column: build_number. Matching build numbers update existing units; new
              builds are created. Stations must already exist. Assigning a unit number clears it
              from any other apparatus that currently holds it.
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
                      {err.build_number ? ` (${err.build_number})` : ""}: {err.message}
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
                    <th className="px-2 py-1.5 font-medium">Build #</th>
                    <th className="px-2 py-1.5 font-medium">Unit</th>
                    <th className="px-2 py-1.5 font-medium">Type</th>
                    <th className="px-2 py-1.5 font-medium">Station</th>
                    <th className="px-2 py-1.5 font-medium">Status</th>
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
                      <td className="px-2 py-1.5 font-medium">{row.build_number || "—"}</td>
                      <td className="px-2 py-1.5">{row.unit_number || "—"}</td>
                      <td className="px-2 py-1.5">{row.apparatus_type || "—"}</td>
                      <td className="px-2 py-1.5">{row.station || "—"}</td>
                      <td className="px-2 py-1.5">{row.status || "in_service"}</td>
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
