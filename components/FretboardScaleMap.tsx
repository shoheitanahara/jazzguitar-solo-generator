"use client";

import * as React from "react";
import type { Chord } from "@/lib/music/types";
import {
  fretboardNotesForScale,
  scaleDefinitionForChord,
  type FretboardNote,
} from "@/lib/music/scaleMap";

const STRING_LABELS = ["e", "B", "G", "D", "A", "E"] as const;
const INLAY_FRETS = new Set([3, 5, 7, 9, 12, 15]);
const DOUBLE_INLAY_FRETS = new Set([12]);

function isInlayFret(fret: number): boolean {
  return INLAY_FRETS.has(fret);
}

function FretInlayDots(props: { fret: number }) {
  const { fret } = props;
  if (!isInlayFret(fret)) {
    return <span className="h-1 sm:h-1.5" aria-hidden />;
  }
  if (DOUBLE_INLAY_FRETS.has(fret)) {
    return (
      <span className="flex items-center justify-center gap-px sm:gap-0.5" aria-hidden>
        <span className="h-1 w-1 rounded-full bg-zinc-500 sm:h-1.5 sm:w-1.5 dark:bg-zinc-400" />
        <span className="h-1 w-1 rounded-full bg-zinc-500 sm:h-1.5 sm:w-1.5 dark:bg-zinc-400" />
      </span>
    );
  }
  return (
    <span className="flex justify-center" aria-hidden>
      <span className="h-1 w-1 rounded-full bg-zinc-500 sm:h-1.5 sm:w-1.5 dark:bg-zinc-400" />
    </span>
  );
}

type Props = {
  chord: Chord;
  startFret?: number;
  endFret?: number;
  badge?: string;
  compact?: boolean;
};

function noteAt(
  notes: readonly FretboardNote[],
  stringFromHigh: number,
  fret: number,
): FretboardNote | undefined {
  const string = (5 - stringFromHigh) as FretboardNote["string"];
  return notes.find((n) => n.string === string && n.fret === fret);
}

export function FretboardScaleMap(props: Props) {
  const { chord, startFret = 5, endFret = 15, badge, compact = false } = props;
  const scale = scaleDefinitionForChord(chord);
  const frets = React.useMemo(() => {
    const list: number[] = [];
    for (let f = startFret; f <= endFret; f += 1) list.push(f);
    return list;
  }, [startFret, endFret]);

  const notes = React.useMemo(
    () =>
      fretboardNotesForScale({
        rootPc: chord.rootPc,
        degrees: scale.degrees,
        chordToneIntervals: chord.chordToneIntervals,
        startFret,
        endFret,
      }),
    [chord.rootPc, chord.chordToneIntervals, scale.degrees, startFret, endFret],
  );

  return (
    <section
      className={`w-full min-w-0 rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 ${
        compact ? "p-1.5 sm:p-2.5" : "p-2 sm:p-4"
      }`}
    >
      <div className={compact ? "mb-1 grid gap-0 sm:mb-2 sm:gap-0.5" : "mb-2 grid gap-0.5 sm:mb-3 sm:gap-1"}>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {badge ? (
            <span className="inline-flex items-center rounded-full bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold text-white sm:px-2.5 sm:text-xs dark:bg-zinc-100 dark:text-zinc-900">
              {badge}
            </span>
          ) : null}
          <h3
            className={`font-semibold text-zinc-900 dark:text-zinc-100 ${
              compact ? "text-sm sm:text-base" : "text-sm sm:text-base"
            }`}
          >
            {chord.text}
          </h3>
        </div>
        <p className="truncate text-[10px] text-zinc-600 sm:text-xs dark:text-zinc-400">{scale.name}</p>
      </div>

      {/* Mobile: fit full width · sm+: slightly roomier but still fluid */}
      <div className="w-full min-w-0">
        <div
          className="grid w-full gap-0"
          style={{
            gridTemplateColumns: `1.35rem repeat(${frets.length}, minmax(0, 1fr))`,
          }}
        >
          <div className="flex flex-col items-center justify-end gap-px pb-0.5 text-[10px] font-medium text-zinc-400 sm:text-[10px]">
            <span>fret</span>
            <span className="h-1 sm:h-1.5" aria-hidden />
          </div>
          {frets.map((f) => (
            <div
              key={`n-${f}`}
              className={`flex flex-col items-center justify-end gap-px pb-0.5 text-[10px] font-semibold sm:text-[11px] ${
                isInlayFret(f) ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-500"
              }`}
            >
              <span>{f}</span>
              <FretInlayDots fret={f} />
            </div>
          ))}

          {STRING_LABELS.map((label, row) => (
            <React.Fragment key={label}>
              <div className="flex items-center justify-center font-mono text-[10px] font-semibold text-zinc-500 sm:text-xs">
                {label}
              </div>
              {frets.map((f) => {
                const note = noteAt(notes, row, f);
                const inlay = isInlayFret(f);
                return (
                  <div
                    key={`${label}-${f}`}
                    className={`relative flex min-w-0 items-center justify-center border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 ${
                      compact ? "h-5 sm:h-6" : "h-5 sm:h-8"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-zinc-300 dark:bg-zinc-600"
                    />
                    {inlay && (row === 2 || (DOUBLE_INLAY_FRETS.has(f) && row === 3)) ? (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute bottom-0 left-1/2 z-0 h-0.5 w-0.5 -translate-x-1/2 rounded-full bg-zinc-400/70 sm:bottom-0.5 sm:h-1 sm:w-1 dark:bg-zinc-500/70"
                      />
                    ) : null}
                    {note ? <DegreeMark note={note} compact={compact} /> : null}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

function DegreeMark(props: { note: FretboardNote; compact?: boolean }) {
  const { note, compact = false } = props;

  if (note.isRoot) {
    return (
      <span
        className={`relative z-10 flex shrink-0 items-center justify-center rounded-full bg-zinc-900 font-bold leading-none text-white ring-1 ring-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:ring-zinc-100 ${
          compact
            ? "h-[18px] w-[18px] text-[11px] sm:h-5 sm:w-5"
            : "h-[18px] w-[18px] text-[11px] sm:h-6 sm:w-6 sm:text-xs"
        }`}
        title="Root"
      >
        R
      </span>
    );
  }

  if (note.isChordTone) {
    return (
      <span
        className={`relative z-10 flex shrink-0 items-center justify-center rounded-full bg-zinc-200 font-semibold leading-none text-zinc-800 ring-1 ring-zinc-400 dark:bg-zinc-700 dark:text-zinc-100 dark:ring-zinc-500 ${
          compact
            ? "h-[18px] min-w-[18px] px-0.5 text-[11px] sm:h-5 sm:min-w-5"
            : "h-[18px] min-w-[18px] px-0.5 text-[11px] sm:h-6 sm:min-w-6 sm:text-[11px]"
        }`}
        title={`Chord tone · ${note.label}`}
      >
        {note.label}
      </span>
    );
  }

  return (
    <span
      className={`relative z-10 flex shrink-0 items-center justify-center rounded-full bg-white font-semibold leading-none text-zinc-800 shadow-sm ring-1 ring-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-600 ${
        compact
          ? "h-[18px] min-w-[18px] px-0.5 text-[11px] sm:h-5 sm:min-w-5"
          : "h-[18px] min-w-[18px] px-0.5 text-[11px] sm:h-6 sm:min-w-6 sm:text-[11px]"
      }`}
      title={note.label}
    >
      {note.label}
    </span>
  );
}
