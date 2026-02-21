"use client";

import * as React from "react";
import type { GeneratedItem } from "@/lib/engine";

type Props = {
  selected: GeneratedItem | null;
};

export function Explanation(props: Props) {
  const { selected } = props;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Note Choice Explanation</h2>
        {selected ? (
          <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
            {selected.id}
          </span>
        ) : null}
      </div>

      {!selected ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Click a TAB candidate to see an explanation here.
        </p>
      ) : (
        <div className="grid gap-3">
          <p className="text-sm text-zinc-800 dark:text-zinc-200">{selected.explanation.summary}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            {selected.explanation.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
          <details className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Score details
            </summary>
            <pre className="mt-2 overflow-auto font-mono text-xs leading-5 text-zinc-800 dark:text-zinc-200">
{JSON.stringify(selected.breakdown, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </section>
  );
}

