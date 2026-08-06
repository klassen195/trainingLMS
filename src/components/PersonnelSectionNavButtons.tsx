"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";

function currentSectionHash() {
  if (typeof window === "undefined") return "";
  const hash = window.location.hash;
  return hash.startsWith("#") ? hash : "";
}

export function PersonnelEditButton({ personId }: { personId: string }) {
  const router = useRouter();

  return (
    <Button
      type="button"
      onClick={() => {
        router.push(`/personnel/${personId}/edit${currentSectionHash()}`);
      }}
    >
      <Pencil className="mr-2 h-4 w-4" />
      Edit
    </Button>
  );
}

export function PersonnelBackToFileButton({ personId }: { personId: string }) {
  return (
    <Button asChild variant="secondary">
      <Link
        href={`/personnel/${personId}`}
        onClick={(e) => {
          const hash = currentSectionHash();
          if (!hash) return;
          e.preventDefault();
          window.location.assign(`/personnel/${personId}${hash}`);
        }}
      >
        Back to file
      </Link>
    </Button>
  );
}
