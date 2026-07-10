import Link from "next/link";
import { tagLabel, programTags } from "@/lib/labels";
import type { ProgramTag } from "@/lib/training-lms-types";
import { Badge } from "@/components/ui/Badge";

export function ProgramCategoryFilters({
  basePath,
  activeCategory,
  activeTag,
}: {
  basePath: string;
  activeCategory?: ProgramTag;
  activeTag?: ProgramTag;
}) {
  const selected = activeTag ?? activeCategory;

  return (
    <div className="mb-8 flex flex-wrap gap-2">
      <Link href={basePath}>
        <Badge variant={!selected ? "default" : "outline"} className="cursor-pointer px-3 py-1.5">
          All
        </Badge>
      </Link>
      {programTags.map((tag) => (
        <Link key={tag} href={`${basePath}?tag=${tag}`}>
          <Badge
            variant={selected === tag ? "default" : "outline"}
            className="cursor-pointer px-3 py-1.5"
          >
            {tagLabel(tag)}
          </Badge>
        </Link>
      ))}
    </div>
  );
}
