import { cn } from "@/lib/cn";

export function FieldLabel({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label {...props} className={cn("block text-sm font-medium text-zinc-700 dark:text-zinc-300", className)} />;
}

export function FieldHint({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span {...props} className={cn("text-xs text-zinc-500 dark:text-zinc-400", className)} />;
}

export function FieldError({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} className={cn("text-sm text-red-700", className)} />;
}

export function FieldSuccess({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} className={cn("text-sm text-green-700", className)} />;
}

