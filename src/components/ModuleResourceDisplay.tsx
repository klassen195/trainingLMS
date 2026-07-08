import { getYouTubeWatchUrl, resourceTypeLabel } from "@/lib/module-resources";
import type { ModuleResourceWithUrl } from "@/lib/training-lms-types";
import { Badge } from "@/components/ui/Badge";

export function ModuleResourceDisplay({ resource }: { resource: ModuleResourceWithUrl }) {
  return (
    <article className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{resource.title}</h1>
          <Badge variant="outline" className="mt-2">
            {resourceTypeLabel(resource.resource_type)}
          </Badge>
        </div>
        {resource.url && resource.resource_type !== "youtube" && resource.resource_type !== "link" ? (
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary underline"
          >
            Open / download
          </a>
        ) : null}
        {resource.resource_type === "link" && resource.url ? (
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary underline"
          >
            Open website
          </a>
        ) : null}
        {resource.resource_type === "youtube" && resource.file_name ? (
          <a
            href={getYouTubeWatchUrl(resource.file_name)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary underline"
          >
            Watch on YouTube
          </a>
        ) : null}
      </div>

      {resource.url && resource.resource_type === "video" ? (
        <video controls preload="metadata" className="w-full rounded-lg bg-black" src={resource.url}>
          Your browser does not support embedded video.
        </video>
      ) : null}

      {resource.url && resource.resource_type === "youtube" ? (
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
          <iframe
            title={resource.title}
            src={resource.url}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      ) : null}

      {resource.url && resource.resource_type === "pdf" ? (
        <iframe
          title={resource.title}
          src={resource.url}
          className="h-[70vh] min-h-[24rem] w-full rounded-lg border"
        />
      ) : null}

      {resource.resource_type === "link" && resource.url ? (
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-sm text-muted-foreground">External resource</p>
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block break-all text-base font-medium text-primary underline"
          >
            {resource.url}
          </a>
        </div>
      ) : null}

      {resource.resource_type === "powerpoint" ? (
        <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
          PowerPoint files download for viewing in Microsoft PowerPoint or another compatible app.
        </p>
      ) : null}

      {!resource.url &&
      resource.resource_type !== "powerpoint" &&
      resource.resource_type !== "link" &&
      resource.resource_type !== "checklist" ? (
        <p className="text-sm text-muted-foreground">This resource is not available right now.</p>
      ) : null}
    </article>
  );
}
