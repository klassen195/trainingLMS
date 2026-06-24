import Link from "next/link";
import { categoryLabel, programCategories } from "@/lib/labels";
import type { ProgramCategory } from "@/lib/training-lms-types";
import { Badge } from "@/components/ui/Badge";

export function ProgramCategoryFilters({
  basePath,
  activeCategory,
}: {
  basePath: string;
  activeCategory?: ProgramCategory;
}) {
  return (
    <div className="mb-8 flex flex-wrap gap-2">
      <Link href={basePath}>
        <Badge variant={!activeCategory ? "default" : "outline"} className="cursor-pointer px-3 py-1.5">
          All
        </Badge>
      </Link>
      {programCategories.map((cat) => (
        <Link key={cat} href={`${basePath}?category=${cat}`}>
          <Badge
            variant={activeCategory === cat ? "default" : "outline"}
            className="cursor-pointer px-3 py-1.5"
          >
            {categoryLabel(cat)}
          </Badge>
        </Link>
      ))}
    </div>
  );
}
