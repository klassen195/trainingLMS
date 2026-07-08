"use client";

import { useTransition } from "react";
import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { toggleModuleHighlight, toggleProgramHighlight } from "@/app/actions";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";

type HighlightStarButtonProps = {
  highlighted: boolean;
  label: string;
  className?: string;
} & (
  | { target: "program"; programId: string }
  | { target: "module"; moduleId: string; programId: string }
);

export function HighlightStarButton(props: HighlightStarButtonProps) {
  const { highlighted, label, className } = props;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    startTransition(async () => {
      if (props.target === "program") {
        await toggleProgramHighlight({ programId: props.programId });
      } else {
        await toggleModuleHighlight({ moduleId: props.moduleId, programId: props.programId });
      }
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-9 w-9 shrink-0", className)}
      disabled={pending}
      aria-pressed={highlighted}
      aria-label={highlighted ? `Remove ${label} from My Programs` : `Add ${label} to My Programs`}
      title={highlighted ? "Remove from My Programs" : "Add to My Programs"}
      onClick={handleClick}
    >
      <Star
        className={cn(
          "h-5 w-5 transition-colors",
          highlighted ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
        )}
      />
    </Button>
  );
}
