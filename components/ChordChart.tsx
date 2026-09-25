"use client";

import * as React from "react";
import type { Bar } from "@/lib/music/types";

export type ChordChartSection = {
  label: string;
  startBarIndex: number;
  endBarIndexExclusive: number;
};

type Props = {
  title: string;
  subtitle?: string;
  bars: readonly Bar[];
  sections: readonly ChordChartSection[];
  barsPerLine?: number;
  activeBarIndex?: number | null;
  activeSegmentIndex?: number | null;
  onSeekBar?: (barIndex: number, segmentIndex: number) => void;
};

function barChordLabel(bar: Bar): string {
  return bar.segments.map((s) => s.chord.text).join(" · ");
}

export function ChordChart(props: Props) {
  const {
    title,
    subtitle,
    bars,
    sections,
    barsPerLine = 4,
    activeBarIndex = null,
    activeSegmentIndex = null,
    onSeekBar,
  } = props;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm sm:p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-4 grid gap-1">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
        {subtitle ? (
          <p className="text-xs text-zinc-600 dark:text-zinc-400">{subtitle}</p>
        ) : null}
      </div>

      <div className="grid gap-5">
        {sections.map((sec) => {
          const rows: { start: number; slice: Bar[] }[] = [];
          for (let i = sec.startBarIndex; i < sec.endBarIndexExclusive; i += barsPerLine) {
            rows.push({
              start: i,
              slice: bars.slice(i, Math.min(i + barsPerLine, sec.endBarIndexExclusive)),
            });
          }

          const sectionActive =
            activeBarIndex != null &&
            activeBarIndex >= sec.startBarIndex &&
            activeBarIndex < sec.endBarIndexExclusive;

          return (
            <div key={`${sec.label}-${sec.startBarIndex}`} className="grid gap-2">
              <div className="flex flex-wrap items-baseline gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    sectionActive
                      ? "bg-emerald-700 text-white dark:bg-emerald-400 dark:text-zinc-900"
                      : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  }`}
                >
                  {sec.label}
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  bars {sec.startBarIndex + 1}–{sec.endBarIndexExclusive}
                </span>
              </div>

              <div className="grid gap-2">
                {rows.map((row) => (
                  <div
                    key={row.start}
                    className="grid gap-px"
                    style={{
                      gridTemplateColumns: `repeat(${barsPerLine}, minmax(0, 1fr))`,
                    }}
                  >
                    {Array.from({ length: barsPerLine }).map((_, col) => {
                      const bar = row.slice[col];
                      const barIndex = row.start + col;
                      const barNo = barIndex + 1;
                      if (!bar) {
                        return <div key={`empty-${col}`} className="min-h-16" />;
                      }
                      const isActiveBar = activeBarIndex === barIndex;
                      return (
                        <div
                          key={barNo}
                          role={onSeekBar ? "button" : undefined}
                          tabIndex={onSeekBar ? 0 : undefined}
                          onClick={() => onSeekBar?.(barIndex, 0)}
                          onKeyDown={(e) => {
                            if (!onSeekBar) return;
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onSeekBar(barIndex, 0);
                            }
                          }}
                          className={`flex min-h-16 flex-col gap-1.5 border p-2 transition-colors ${
                            onSeekBar ? "cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500" : ""
                          } ${
                            isActiveBar
                              ? "border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-950/40"
                              : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50"
                          }`}
                        >
                          <span
                            className={`text-[10px] font-semibold ${
                              isActiveBar ? "text-emerald-700 dark:text-emerald-300" : "text-zinc-400"
                            }`}
                          >
                            {barNo}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {bar.segments.map((seg, idx) => {
                              const isActiveSeg =
                                isActiveBar &&
                                (activeSegmentIndex == null || activeSegmentIndex === idx);
                              return (
                                <span
                                  key={`${barNo}-${idx}-${seg.chord.text}`}
                                  onClick={(e) => {
                                    if (!onSeekBar) return;
                                    e.stopPropagation();
                                    onSeekBar(barIndex, idx);
                                  }}
                                  className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-sm font-semibold shadow-sm ring-1 transition-colors ${
                                    onSeekBar ? "cursor-pointer hover:ring-zinc-500" : ""
                                  } ${
                                    isActiveSeg
                                      ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:ring-zinc-100"
                                      : "bg-white text-zinc-800 ring-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-600"
                                  }`}
                                  title={`${seg.beats} beat${seg.beats === 1 ? "" : "s"}`}
                                >
                                  {seg.chord.text}
                                </span>
                              );
                            })}
                          </div>
                          {bar.segments.length > 1 ? (
                            <span className="sr-only">{barChordLabel(bar)}</span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
