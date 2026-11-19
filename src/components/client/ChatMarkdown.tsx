"use client";

import React from "react";

function renderInlineMarkdown(text: string, isUser: boolean): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong
          key={`b-${keyIdx++}`}
          className={
            isUser
              ? "font-semibold text-white"
              : "font-semibold text-[#1E103C]"
          }
        >
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={`c-${keyIdx++}`}
          className={
            isUser
              ? "px-1 py-0.5 rounded bg-white/20 text-white font-mono text-[12px]"
              : "px-1.5 py-0.5 rounded bg-[#F4EEFF] text-[#4502C7] font-mono text-[12px] font-medium"
          }
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

export function ChatMarkdown({
  content,
  isUser = false,
}: {
  content: string;
  isUser?: boolean;
}) {
  const lines = content.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Horizontal rule (--- or ***)
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      blocks.push(
        <hr key={`hr-${blockKey++}`} className="border-[#E8E6F2] my-1.5" />
      );
      i++;
      continue;
    }

    // Heading (#, ##, ###)
    const headingMatch = trimmed.match(/^#{1,4}\s+(.*)$/);
    if (headingMatch) {
      blocks.push(
        <p
          key={`h-${blockKey++}`}
          className={
            isUser
              ? "font-bold text-white text-[13.5px] pt-1"
              : "font-bold text-[#1E103C] text-[13.5px] pt-1"
          }
        >
          {renderInlineMarkdown(headingMatch[1], isUser)}
        </p>
      );
      i++;
      continue;
    }

    // Bullet list (- or * or •)
    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul
          key={`ul-${blockKey++}`}
          className="list-disc pl-4 space-y-1 my-1"
        >
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineMarkdown(item, isUser)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list (1. 2. 3.)
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      const startNum = Number(olMatch[1]) || 1;
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].trim().match(/^\d+\.\s+(.*)$/);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      blocks.push(
        <ol
          key={`ol-${blockKey++}`}
          start={startNum}
          className="list-decimal pl-4 space-y-1 my-1"
        >
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineMarkdown(item, isUser)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Regular paragraph lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^[-*•]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    blocks.push(
      <p key={`p-${blockKey++}`} className="leading-relaxed">
        {paraLines.map((pl, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <br />}
            {renderInlineMarkdown(pl, isUser)}
          </React.Fragment>
        ))}
      </p>
    );
  }

  return <div className="space-y-1.5">{blocks}</div>;
}
