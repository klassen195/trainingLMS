"use client";

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import { convertHeicBlobToJpeg, isHeicImage } from "@/lib/heic";
import { formatDateTime } from "@/lib/dates";
import { renderPdfFirstPageThumbnailDataUrl } from "@/lib/pdf-thumbnail";
import { personnelFilePreviewKind } from "@/lib/personnel-types";
import type { ReportBranding, ReportColumn, ReportExportMeta } from "@/lib/reports/types";

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#1f2937",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: "#1e3a5f",
  },
  logo: {
    width: 48,
    height: 48,
    objectFit: "contain",
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  department: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#1e3a5f",
    marginBottom: 2,
  },
  title: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  meta: {
    marginBottom: 14,
    color: "#4b5563",
    fontSize: 8,
    lineHeight: 1.4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1e3a5f",
    color: "#ffffff",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
  },
  tableRowAlt: {
    backgroundColor: "#f8fafc",
  },
  cell: {
    paddingHorizontal: 3,
  },
  headerCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
  },
  thumbCell: {
    paddingHorizontal: 3,
    justifyContent: "center",
  },
  thumb: {
    width: 54,
    height: 36,
    objectFit: "contain",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#6b7280",
    borderTopWidth: 0.5,
    borderTopColor: "#d1d5db",
    paddingTop: 8,
  },
});

function columnFlex(columnCount: number) {
  return Math.max(1, Math.floor(100 / Math.max(columnCount, 1)));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(blob);
  });
}

/**
 * react-pdf can only embed raster images. Convert PDF/HEIC preview URLs to JPEG
 * data URLs so certificate thumbnails appear in the exported report.
 */
async function prepareImageCellsForPdf(
  columns: ReportColumn[],
  rows: Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  const imageColumns = columns.filter((column) => column.format === "image");
  if (imageColumns.length === 0) return rows;

  return Promise.all(
    rows.map(async (row) => {
      let next = row;
      for (const column of imageColumns) {
        const src = row[column.key] == null ? "" : String(row[column.key]).trim();
        if (!src) continue;

        const mime =
          column.mimeKey && row[column.mimeKey] != null ? String(row[column.mimeKey]) : "";
        const fileName =
          column.fileNameKey && row[column.fileNameKey] != null
            ? String(row[column.fileNameKey])
            : "";
        const kind = personnelFilePreviewKind(mime, fileName);

        try {
          if (kind === "pdf") {
            const dataUrl = await renderPdfFirstPageThumbnailDataUrl(src);
            next = {
              ...next,
              [column.key]: dataUrl,
              ...(column.mimeKey ? { [column.mimeKey]: "image/jpeg" } : {}),
            };
          } else if (isHeicImage(mime, fileName)) {
            const response = await fetch(src);
            if (!response.ok) continue;
            const jpeg = await convertHeicBlobToJpeg(await response.blob());
            next = {
              ...next,
              [column.key]: await blobToDataUrl(jpeg),
              ...(column.mimeKey ? { [column.mimeKey]: "image/jpeg" } : {}),
            };
          }
        } catch {
          // Leave original cell; PdfCell falls back to a text label.
        }
      }
      return next;
    })
  );
}

function PdfCell({
  column,
  row,
  flex,
}: {
  column: ReportColumn;
  row: Record<string, unknown>;
  flex: number;
}) {
  if (column.format === "image") {
    const src = row[column.key] == null ? "" : String(row[column.key]).trim();
    const mime =
      column.mimeKey && row[column.mimeKey] != null
        ? String(row[column.mimeKey]).toLowerCase()
        : "";
    const fileName =
      column.fileNameKey && row[column.fileNameKey] != null
        ? String(row[column.fileNameKey]).trim()
        : "";
    const isDataImage = src.startsWith("data:image/");
    const isRaster =
      isDataImage ||
      (mime.startsWith("image/") && !mime.includes("heic") && !mime.includes("heif"));

    if (src && isRaster) {
      return (
        <View style={[styles.thumbCell, { flex }]}>
          <Image src={src} style={styles.thumb} />
        </View>
      );
    }

    const label = !src ? "—" : fileName || (mime === "application/pdf" ? "PDF" : "File");
    return <Text style={[styles.cell, { flex }]}>{label}</Text>;
  }

  return (
    <Text style={[styles.cell, { flex }]}>
      {row[column.key] == null || row[column.key] === "" ? "—" : String(row[column.key])}
    </Text>
  );
}

export function ReportPdfDocument({
  branding,
  meta,
  columns,
  rows,
}: {
  branding: ReportBranding;
  meta: ReportExportMeta;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
}) {
  const generatedAt = meta.generatedAt ?? new Date();
  const flex = columnFlex(columns.length);

  return (
    <Document>
      <Page size="LETTER" orientation={columns.length > 6 ? "landscape" : "portrait"} style={styles.page}>
        <View style={styles.header} fixed>
          {branding.logoDataUrl ? (
            <Image src={branding.logoDataUrl} style={styles.logo} />
          ) : null}
          <View style={styles.headerText}>
            <Text style={styles.department}>{branding.departmentName}</Text>
            <Text style={styles.title}>{meta.title}</Text>
          </View>
        </View>

        <View style={styles.meta}>
          <Text>
            Generated {formatDateTime(generatedAt.toISOString())} · {rows.length} row
            {rows.length === 1 ? "" : "s"}
          </Text>
          {meta.filterSummary ? <Text>{meta.filterSummary}</Text> : null}
        </View>

        <View style={styles.tableHeader} fixed>
          {columns.map((column) => (
            <Text
              key={column.key}
              style={[styles.cell, styles.headerCell, { flex }]}
            >
              {column.header}
            </Text>
          ))}
        </View>

        {rows.map((row, index) => (
          <View
            key={index}
            style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
            wrap={false}
          >
            {columns.map((column) => (
              <PdfCell key={column.key} column={column} row={row} flex={flex} />
            ))}
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text>{branding.departmentName} · Reports</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

export async function downloadReportPdf(input: {
  filename: string;
  branding: ReportBranding;
  meta: ReportExportMeta;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
}) {
  const rows = await prepareImageCellsForPdf(input.columns, input.rows);
  const blob = await pdf(
    <ReportPdfDocument
      branding={input.branding}
      meta={input.meta}
      columns={input.columns}
      rows={rows}
    />
  ).toBlob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = input.filename.endsWith(".pdf") ? input.filename : `${input.filename}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
