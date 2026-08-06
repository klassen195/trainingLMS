import { Fragment, type ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

/** Renders the subset of Markdown used in ideas.md (headings, paragraphs, lists). */
export function IdeasMarkdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  function flushList() {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={key++} className="mb-6 list-disc space-y-1 pl-6 text-sm leading-relaxed">
        {listItems.map((item, index) => (
          <li key={index} className="text-foreground">
            {renderInline(item)}
          </li>
        ))}
      </ul>
    );
    listItems = [];
  }

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.startsWith("# ")) {
      flushList();
      // Page already shows the H1 title; skip duplicate from the file.
      continue;
    }

    if (line.startsWith("## ")) {
      flushList();
      blocks.push(
        <h2 key={key++} className="mb-3 mt-8 text-xl font-semibold tracking-tight first:mt-0">
          {renderInline(line.slice(3))}
        </h2>
      );
      continue;
    }

    if (line.startsWith("- ")) {
      listItems.push(line.slice(2));
      continue;
    }

    if (line.trim() === "") {
      flushList();
      continue;
    }

    flushList();
    blocks.push(
      <p key={key++} className="mb-6 text-lg leading-relaxed text-muted-foreground first:mt-2">
        {renderInline(line)}
      </p>
    );
  }

  flushList();

  return <div>{blocks}</div>;
}
