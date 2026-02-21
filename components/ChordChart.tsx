"use client";

import * as React from "react";

type Props = {
  title: string;
  subtitle?: string;
  lines: readonly string[];
};

export function ChordChart(props: Props) {
  const { title, subtitle, lines } = props;
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="grid gap-1">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
          {subtitle ? (
            <div className="text-xs text-zinc-600 dark:text-zinc-400">{subtitle}</div>
          ) : null}
        </div>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">Wrap every 4 bars</span>
      </div>
      <pre className="overflow-auto rounded-md bg-zinc-50 p-3 font-mono text-sm leading-6 text-zinc-900 dark:bg-zinc-900/40 dark:text-zinc-100">
        {lines.join("\n")}
      </pre>
    </section>
  );
}

