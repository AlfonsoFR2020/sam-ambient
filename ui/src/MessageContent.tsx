import type { ReactNode } from "react";

const INLINE_MARKUP = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;

function inline(text: string): ReactNode[] {
  let offset = 0;
  return text.split(INLINE_MARKUP).map((part) => {
    const start = offset;
    offset += part.length;
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={`${start}:${part}`}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={`${start}:${part}`}>{part.slice(1, -1)}</em>;
    return part;
  });
}

/** A deliberately small, escaped subset for ordinary model prose. */
export function MessageContent({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    if (!lines[index].trim()) {
      index += 1;
      continue;
    }
    const list = /^\s*(?:([-*])|(\d+)\.)\s+(.+)$/.exec(lines[index]);
    if (list) {
      const start = index;
      const ordered = Boolean(list[2]);
      const items: ReactNode[] = [];
      while (index < lines.length) {
        const match = /^\s*(?:([-*])|(\d+)\.)\s+(.+)$/.exec(lines[index]);
        if (!match || Boolean(match[2]) !== ordered) break;
        items.push(<li key={`${index}:${match[3]}`}>{inline(match[3])}</li>);
        index += 1;
      }
      blocks.push(
        ordered ? <ol key={`list:${start}`}>{items}</ol> : <ul key={`list:${start}`}>{items}</ul>,
      );
      continue;
    }
    const paragraph: string[] = [];
    const start = index;
    while (index < lines.length && lines[index].trim()) {
      if (paragraph.length && /^\s*(?:[-*]|\d+\.)\s+/.test(lines[index])) break;
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p key={`paragraph:${start}`}>{inline(paragraph.join(" "))}</p>);
  }
  return <div className="transcript__content">{blocks}</div>;
}
