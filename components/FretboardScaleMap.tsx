"use client";

import * as React from "react";
import type { Chord } from "@/lib/music/types";
import {
  fretboardNotesForScale,
  scaleDefinitionForChord,
  type FretboardNote,
} from "@/lib/music/scaleMap";

const STRING_LABELS = ["e", "B", "G", "D", "A", "E"] as const; // 1弦→6弦（上が1弦）
const FRET_MARKERS = new Set([3, 5, 7, 9, 12, 15]);

type Props = {
  chord: Chord;
  startFret?: number;
  endFret?: number;
  /** "Now" / "Next" などのバッジ */
  badge?: string;
  /** コンパクト表示（ライブ用） */
  compact?: boolean;
};

function noteAt(
  notes: readonly FretboardNote[],
  stringFromHigh: number,
  fret: number,
): FretboardNote | undefined {
  // stringFromHigh: 0=1弦 … 5=6弦 → internal string index は逆
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
      className={`rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 ${
        compact ? "p-2.5" : "p-4"
      }`}
    >
      <div className={compact ? "mb-2 grid gap-0.5" : "mb-3 grid gap-1"}>
        <div className="flex flex-wrap items-center gap-2">
          {badge ? (
            <span className="inline-flex items-center rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
              {badge}
            </span>
          ) : null}
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {chord.text}
          </h3>
        </div>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">{scale.name}</p>
      </div>

      <div className="overflow-x-auto">
        <div
          className="inline-grid min-w-full gap-px"
          style={{
            gridTemplateColumns: `2.25rem repeat(${frets.length}, minmax(${compact ? "1.75rem" : "2.25rem"}, 1fr))`,
          }}
        >
          <div className="flex items-end justify-center pb-1 text-[10px] font-medium text-zinc-400">
            fret
          </div>
          {frets.map((f) => (
            <div
              key={`n-${f}`}
              className={`flex items-end justify-center pb-1 text-xs font-semibold ${
                FRET_MARKERS.has(f) ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-500"
              }`}
            >
              {f}
            </div>
          ))}

          {STRING_LABELS.map((label, row) => (
            <React.Fragment key={label}>
              <div className="flex items-center justify-center font-mono text-xs font-semibold text-zinc-500">
                {label}
              </div>
              {frets.map((f) => {
                const note = noteAt(notes, row, f);
                return (
                  <div
                    key={`${label}-${f}`}
                    className={`relative flex items-center justify-center border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 ${
                      compact ? "h-7" : "h-9"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-zinc-300 dark:bg-zinc-600"
                    />
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
  const size = compact ? "h-6 min-w-6 text-[10px]" : "h-7 min-w-7 text-[11px]";

  // Root: strongest
  if (note.isRoot) {
    return (
      <span
        className={`relative z-10 flex items-center justify-center rounded-full bg-zinc-900 font-bold text-white ring-2 ring-zinc-900 ring-offset-1 ring-offset-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 dark:ring-zinc-100 dark:ring-offset-zinc-900 ${
          compact ? "h-6 w-6 text-[10px]" : "h-7 w-7 text-xs"
        }`}
        title="Root"
      >
        R
      </span>
    );
  }

  // Chord tones (3 / 5 / 7 …): subtle — outline + light fill (Root stays strongest)
  if (note.isChordTone) {
    return (
      <span
        className={`relative z-10 flex items-center justify-center rounded-full bg-zinc-200 px-1 font-semibold text-zinc-800 ring-2 ring-zinc-400 dark:bg-zinc-700 dark:text-zinc-100 dark:ring-zinc-500 ${size}`}
        title={`Chord tone · ${note.label}`}
      >
        {note.label}
      </span>
    );
  }

  // Scale tones / tensions: light
  return (
    <span
      className={`relative z-10 flex items-center justify-center rounded-full bg-white px-1 font-semibold text-zinc-800 shadow-sm ring-1 ring-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-600 ${size}`}
      title={note.label}
    >
      {note.label}
    </span>
  );
}
