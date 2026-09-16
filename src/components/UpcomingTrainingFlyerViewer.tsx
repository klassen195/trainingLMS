import { UpcomingTrainingFlyerDownloadButton } from "@/components/UpcomingTrainingFlyerDownloadButton";

function isPdfFlyer(mimeType: string | null | undefined, fileName: string) {
  if (mimeType === "application/pdf") return true;
  return fileName.toLowerCase().endsWith(".pdf");
}

function isImageFlyer(mimeType: string | null | undefined, fileName: string) {
  if (mimeType?.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|heic|heif)$/i.test(fileName);
}

export function UpcomingTrainingFlyerViewer({
  upcomingTrainingId,
  fileName,
  mimeType,
  url,
}: {
  upcomingTrainingId: string;
  fileName: string;
  mimeType: string | null;
  url: string;
}) {
  const pdf = isPdfFlyer(mimeType, fileName);
  const image = isImageFlyer(mimeType, fileName);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Flyer</h2>
        <UpcomingTrainingFlyerDownloadButton upcomingTrainingId={upcomingTrainingId} />
      </div>
      {image ? (
        // Signed storage URL for flyer preview
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={fileName}
          className="max-h-[70vh] w-full rounded-md border object-contain bg-muted/20"
        />
      ) : pdf ? (
        <iframe
          src={url}
          title={fileName}
          className="h-[70vh] w-full rounded-md border bg-muted/20"
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Preview is not available for this file type. Use the download button to open it.
        </p>
      )}
    </div>
  );
}
