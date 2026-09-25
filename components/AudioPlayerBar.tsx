"use client";

import * as React from "react";
import { createPortal } from "react-dom";
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

/** iOS Safari のアドレスバーで fixed bottom がずれるのを補正 */
function useVisualViewportBottom(): number {
  const [bottom, setBottom] = React.useState(0);

  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setBottom(offset);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("scroll", update);
    };
  }, []);

  return bottom;
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
  const vvBottom = useVisualViewportBottom();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const seekFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el || !(durationSec > 0)) return;
    const rect = el.getBoundingClientRect();
    const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    onSeekRatio(ratio);
  };

  const bar = (
    <div
      className="fixed inset-x-0 z-[100] flex flex-col border-t border-zinc-300 bg-zinc-100 shadow-[0_-6px_20px_rgba(0,0,0,0.08)] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[0_-6px_20px_rgba(0,0,0,0.45)]"
      style={{
        bottom: vvBottom,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {nowChord ? (
        <div className="w-full px-1.5 pt-1.5 sm:mx-auto sm:max-w-5xl sm:px-4 sm:pt-2">
          <div className="max-h-[min(36dvh,15rem)] overflow-y-auto overscroll-contain rounded-lg border border-zinc-300 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-950 sm:max-h-[min(40dvh,20rem)] sm:px-2 sm:pt-2">
            <div className="grid gap-2 pb-1 sm:pb-2 lg:grid-cols-2">
              <FretboardScaleMap
                key={`now-${nowChord.text}-${activeBarIndex}-${activeSegmentIndex}`}
                chord={nowChord}
                badge="Now"
                compact
              />
              {nextChord ? (
                <div className="hidden lg:block">
                  <FretboardScaleMap
                    key={`next-${nextChord.text}-${activeBarIndex}-${activeSegmentIndex}`}
                    chord={nextChord}
                    badge="Next"
                    compact
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="border-t border-zinc-300/80 dark:border-zinc-700/80">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-1.5 px-2 py-2 sm:gap-2 sm:px-4 sm:py-3">
          {!nowChord ? (
            <div className="rounded-lg border border-dashed border-zinc-400 bg-white px-3 py-2 text-xs text-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
              {phase.kind === "count-in"
                ? `Count-in ${phase.countBeat}/${phase.totalCountIn}`
                : "Press Play"}
            </div>
          ) : null}

          <div
            ref={trackRef}
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.floor(durationSec)}
            aria-valuenow={Math.floor(currentTimeSec)}
            tabIndex={0}
            className="group relative h-4 cursor-pointer py-1.5"
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
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-zinc-900 transition-[width] duration-75 dark:bg-zinc-100"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onTogglePlay}
              className="inline-flex h-11 min-w-[4.5rem] shrink-0 items-center justify-center rounded-full bg-zinc-900 px-4 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              onClick={onStop}
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-zinc-800 ring-1 ring-zinc-300 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-600"
            >
              Stop
            </button>

            <div className="min-w-0 flex-1 grid gap-0.5">
              <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {phaseLabel(phase)}
              </div>
              <div className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                {formatTime(currentTimeSec)} / {formatTime(durationSec)} · {bpm} BPM
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(bar, document.body);
}
