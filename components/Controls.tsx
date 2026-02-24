"use client";

import * as React from "react";
import type { Level, Style } from "@/lib/generator";
import { STYLE_OPTIONS, paramsForStyle, styleOptionOf } from "@/lib/stylePresets";
import { Slider } from "./Slider";

type Props = {
  style: Style;
  level: Level;
  seedText: string;
  isSeedLocked: boolean;
  onChange: (next: {
    style?: Style;
    level?: Level;
    seedText?: string;
    isSeedLocked?: boolean;
  }) => void;
  onGenerate: () => void;
  isGenerating: boolean;
};

export function Controls(props: Props) {
  const { style, level, seedText, isSeedLocked, onChange, onGenerate, isGenerating } = props;
  const option = styleOptionOf(style);
  const tuned = React.useMemo(() => paramsForStyle(style, level), [style, level]);

  return (
    <div className="grid gap-4">
      {/* style + seed を横並び（素人が触るのはここだけ） */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Style</span>
          <select
            value={style}
            onChange={(e) => onChange({ style: e.target.value as Style })}
            className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            {STYLE_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <p className="text-xs leading-5 text-zinc-600 dark:text-zinc-400">{option.description}</p>
        </label>

        <label className="flex flex-col gap-2">
          <div className="flex items-end justify-between gap-2">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Seed</span>
            <button
              type="button"
              onClick={() => onChange({ isSeedLocked: !isSeedLocked })}
              className="h-7 rounded-md border border-zinc-300 bg-white px-2 text-xs font-semibold text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              {isSeedLocked ? "Locked" : "Random"}
            </button>
          </div>
          <input
            value={seedText}
            onChange={(e) => onChange({ seedText: e.target.value })}
            placeholder="e.g. 20260221 / hello"
            disabled={!isSeedLocked}
            className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <p className="text-xs leading-5 text-zinc-600 dark:text-zinc-400">
            {isSeedLocked
              ? "Same seed → same results."
              : "Seed changes on every Generate (auto-updates here)."}
          </p>
        </label>
      </div>

      {/* Level は解説の直上に置いて “何が変わるか” を迷わないようにする */}
      <div className="grid gap-3">
        <Slider
          label="Level (1–6)"
          value={level}
          min={1}
          max={6}
          step={1}
          onChange={(v) => onChange({ level: v as Level })}
          format={(v) => String(Math.round(v))}
        />

        <details className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
          <summary className="cursor-pointer text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            What does Level change?
          </summary>
          <div className="mt-2 grid gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <ul className="list-disc space-y-1 pl-5">
              <li>Note density</li>
              <li>Chromatic / tension-ish notes</li>
              <li>Rhythm complexity (more syncopation / rests)</li>
              <li>Fretboard range (max fret)</li>
              <li>Style-dependent traits (chord hits / motifs)</li>
            </ul>
            <div className="rounded-md border border-zinc-200 bg-white p-3 font-mono text-xs leading-5 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
              Internal params (FYI): density={tuned.density.toFixed(2)} chromatic={tuned.chromaticRate.toFixed(2)} chordHit=
              {tuned.chordHitRate.toFixed(2)} motif={tuned.motifRate.toFixed(2)} maxFret={tuned.maxFret} pos={tuned.positionPreference}F
            </div>
          </div>
        </details>
      </div>

      {/* Generate は下に横長 */}
      <button
        onClick={onGenerate}
        disabled={isGenerating}
        className="h-11 w-full rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white shadow-sm disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950"
      >
        {isGenerating ? "Generating..." : "Generate"}
      </button>
    </div>
  );
}

