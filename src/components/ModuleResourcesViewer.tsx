import { getYouTubeWatchUrl, resourceTypeLabel } from "@/lib/module-resources";
import type { ModuleResourceWithUrl } from "@/lib/training-lms-types";

export function ModuleResourcesViewer({ resources }: { resources: ModuleResourceWithUrl[] }) {
  if (!resources.length) return null;

  return (
    <section className="mt-8 space-y-4">
      <h2 className="text-lg font-semibold text-[#0B2E4B]">Resources</h2>
      <ul className="space-y-4">
        {resources.map((resource) => (
          <li key={resource.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{resource.title}</p>
                <p className="text-xs uppercase tracking-wide text-[#C11B2B]">
                  {resourceTypeLabel(resource.resource_type)}
                </p>
              </div>
              {resource.url && resource.resource_type !== "youtube" ? (
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-[#0B2E4B] underline"
                >
                  Open / download
                </a>
              ) : null}
              {resource.resource_type === "youtube" && resource.file_name ? (
                <a
                  href={getYouTubeWatchUrl(resource.file_name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-[#0B2E4B] underline"
                >
                  Watch on YouTube
                </a>
              ) : null}
            </div>

            {resource.url && resource.resource_type === "video" ? (
              <video
                controls
                preload="metadata"
                className="mt-4 w-full rounded-lg bg-black"
                src={resource.url}
              >
                Your browser does not support embedded video.
              </video>
            ) : null}

            {resource.url && resource.resource_type === "youtube" ? (
              <div className="mt-4 aspect-video w-full overflow-hidden rounded-lg bg-black">
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
                className="mt-4 h-[32rem] w-full rounded-lg border border-zinc-200 dark:border-zinc-800"
              />
            ) : null}

            {resource.resource_type === "powerpoint" ? (
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                PowerPoint files download for viewing in Microsoft PowerPoint or another compatible app.
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
