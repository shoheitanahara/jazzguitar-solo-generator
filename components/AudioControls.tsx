"use client";

import * as React from "react";
import { Slider } from "./Slider";

type Props = {
  variant?: "card" | "footer";
  bpm: number;
  isPlaying: boolean;
  swingAmount: number; // 0..0.9
  compSubdivision: "quarter" | "eighth";
  onChangeBpm: (bpm: number) => void;
  onChangeSwingAmount: (amount: number) => void;
  onChangeCompSubdivision: (subdivision: "quarter" | "eighth") => void;
  onStart: () => void;
  onStop: () => void;
};

export function AudioControls(props: Props) {
  const {
    variant = "card",
    bpm,
    isPlaying,
    swingAmount,
    compSubdivision,
    onChangeBpm,
    onChangeSwingAmount,
    onChangeCompSubdivision,
    onStart,
    onStop,
  } = props;

  const wrapperClassName =
    variant === "card"
      ? "rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      : "grid gap-3";

  return (
    <section className={wrapperClassName}>
      <div className={variant === "card" ? "mb-3 flex items-center justify-between" : "flex items-center justify-between"}>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Chord Playback</h2>
        <div className="flex gap-2">
          {!isPlaying ? (
            <button
              onClick={onStart}
              className="h-9 rounded-md bg-zinc-900 px-3 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-950"
            >
              Start
            </button>
          ) : (
            <button
              onClick={onStop}
              className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      <div className={variant === "footer" ? "grid gap-3 md:grid-cols-2" : "grid gap-3"}>
        <Slider
          label="BPM (60〜220)"
          value={bpm}
          min={60}
          max={220}
          step={1}
          onChange={onChangeBpm}
          format={(v) => `${Math.round(v)} BPM`}
        />

        <Slider
          label="Swing (triplet feel)"
          value={swingAmount}
          min={0}
          max={0.9}
          step={0.05}
          onChange={onChangeSwingAmount}
          format={(v) => (v <= 0.01 ? "OFF" : v.toFixed(2))}
        />
      </div>

      <label className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Comping grid</span>
        <select
          value={compSubdivision}
          onChange={(e) => onChangeCompSubdivision(e.target.value as "quarter" | "eighth")}
          className="h-9 w-40 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          <option value="eighth">8th notes</option>
          <option value="quarter">Quarter notes</option>
        </select>
      </label>

      {variant === "card" ? (
        <>
          <p className="text-xs leading-5 text-zinc-600 dark:text-zinc-400">
            Delays the offbeat 8th-note to create a triplet-like pocket.
          </p>
        </>
      ) : null}
    </section>
  );
}

