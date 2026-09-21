"use client";

import * as React from "react";
import type { Chord } from "@/lib/music/types";
import type { PlaybackPhase } from "@/lib/music/playbackTimeline";
import { FretboardScaleMap } from "@/components/FretboardScaleMap";

type Props = {
  isPlaying: boolean;
  currentTimeSec: number;
  durationSec: number;
  phase: PlaybackPhase;
  bpm: number;
  nowChord: Chord | null;
  nextChord: Chord | null;
  activeBarIndex: number | null;
  activeSegmentIndex: number | null;
  onTogglePlay: () => void;
  onStop: () => void;
  onSeekRatio: (ratio: number) => void;
};

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function phaseLabel(phase: PlaybackPhase): string {
  switch (phase.kind) {
    case "idle":
      return "Ready";
    case "count-in":
      return `Count-in ${phase.countBeat}/${phase.totalCountIn}`;
    case "playing":
      return `Chorus ${phase.chorusIndex + 1} · Bar ${phase.barIndex + 1} · ${phase.slot.chord.text} → ${phase.nextSlot.chord.text}`;
    case "ended":
      return "Ended";
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}

export function AudioPlayerBar(props: Props) {
  const {
    isPlaying,
    currentTimeSec,
    durationSec,
    phase,
    bpm,
    nowChord,
    nextChord,
    activeBarIndex,
    activeSegmentIndex,
    onTogglePlay,
    onStop,
    onSeekRatio,
  } = props;
  const progress = durationSec > 0 ? Math.min(1, currentTimeSec / durationSec) : 0;
  const trackRef = React.useRef<HTMLDivElement | null>(null);

  const seekFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el || !(durationSec > 0)) return;
    const rect = el.getBoundingClientRect();
    const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    onSeekRatio(ratio);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-3">
        <div className="max-h-[min(42vh,22rem)] overflow-y-auto overscroll-contain">
          {nowChord && nextChord ? (
            <div className="grid gap-2 lg:grid-cols-2">
              <FretboardScaleMap
                key={`now-${nowChord.text}-${activeBarIndex}-${activeSegmentIndex}`}
                chord={nowChord}
                badge="Now"
                compact
              />
              <FretboardScaleMap
                key={`next-${nextChord.text}-${activeBarIndex}-${activeSegmentIndex}`}
                chord={nextChord}
                badge="Next"
                compact
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-3 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
              {phase.kind === "count-in"
                ? `Count-in ${phase.countBeat}/${phase.totalCountIn}`
                : "Press Play"}
            </div>
          )}
        </div>

        <div
          ref={trackRef}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.floor(durationSec)}
          aria-valuenow={Math.floor(currentTimeSec)}
          tabIndex={0}
          className="group relative h-3 cursor-pointer py-1"
          onClick={(e) => seekFromClientX(e.clientX)}
          onKeyDown={(e) => {
            if (!(durationSec > 0)) return;
            const step = 2 / durationSec;
            if (e.key === "ArrowRight") {
              e.preventDefault();
              onSeekRatio(Math.min(1, progress + step));
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              onSeekRatio(Math.max(0, progress - step));
            }
          }}
        >
          <div className="h-1 overflow-hidden rounded-full bg-zinc-200 group-hover:h-1.5 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-zinc-900 transition-[width] duration-75 dark:bg-zinc-100"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onTogglePlay}
            className="inline-flex h-10 min-w-24 items-center justify-center rounded-full bg-zinc-900 px-4 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            onClick={onStop}
            className="inline-flex h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-zinc-800 ring-1 ring-zinc-300 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-600"
          >
            Stop
          </button>

          <div className="min-w-0 flex-1 grid gap-0.5">
            <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {phaseLabel(phase)}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {formatTime(currentTimeSec)} / {formatTime(durationSec)} · {bpm} BPM
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
