"use client";

import * as React from "react";
import type { GeneratedItem } from "@/lib/engine";

type Props = {
  items: readonly GeneratedItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

export function GeneratedList(props: Props) {
  const { items, selectedId, onSelect } = props;

  if (items.length === 0) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Generated TAB</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Click Generate to create ranked ideas.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Generated TAB (Top picks)</h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Click to switch explanation / Copy to clipboard
        </span>
      </div>

      <div className="grid gap-4">
        {items.map((item, idx) => {
          const selected = item.id === selectedId;
          return (
            <div
              key={item.id}
              className={[
                "rounded-md border p-3",
                selected
                  ? "border-zinc-900 bg-zinc-50 dark:border-zinc-200 dark:bg-zinc-900/40"
                  : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  onClick={() => onSelect(item.id)}
                  className="text-left text-sm font-semibold text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
                >
                  #{idx + 1} {item.explanation.summary}
                </button>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300">
                    {item.score.toFixed(1)}
                  </span>
                  <button
                    onClick={() => void copyToClipboard(item.tab)}
                    className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs font-semibold text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  >
                    Copy TAB
                  </button>
                </div>
              </div>
              <pre className="mt-3 overflow-auto rounded-md bg-zinc-50 p-3 font-mono text-[11px] leading-5 text-zinc-900 dark:bg-zinc-900/40 dark:text-zinc-100">
                {item.tab}
              </pre>
            </div>
          );
        })}
      </div>
    </section>
  );
}

