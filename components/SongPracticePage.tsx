"use client";

import * as React from "react";
import Link from "next/link";
import { uniqueChordsInSong } from "@/lib/music/scaleMap";
import {
  buildFormTimeline,
  resolvePlaybackPosition,
  seekTimeForProgressRatio,
  seekTimeForSlot,
  type PlaybackPhase,
} from "@/lib/music/playbackTimeline";
import type { SongCatalogEntry } from "@/lib/songs/catalog";
import { ChordChart } from "@/components/ChordChart";
import { FretboardScaleMap } from "@/components/FretboardScaleMap";
import { AudioPlayerBar } from "@/components/AudioPlayerBar";

type Props = {
  entry: SongCatalogEntry;
};

export function SongPracticePage(props: Props) {
  const { entry } = props;
  const { song, sections, bpm, countInBeats, audioSrc, title, keyCenter, formLabel } = entry;

  const uniqueChords = React.useMemo(() => uniqueChordsInSong(song), [song]);
  const timeline = React.useMemo(() => buildFormTimeline(song), [song]);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const rafRef = React.useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTimeSec, setCurrentTimeSec] = React.useState(0);
  const [durationSec, setDurationSec] = React.useState(0);
  const [phase, setPhase] = React.useState<PlaybackPhase>({ kind: "idle" });

  const syncFromAudio = React.useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    const t = el.currentTime;
    const d = Number.isFinite(el.duration) ? el.duration : 0;
    setCurrentTimeSec(t);
    setDurationSec(d);
    setPhase(
      resolvePlaybackPosition({
        currentTimeSec: t,
        durationSec: d,
        bpm,
        countInBeats,
        timeline,
        isPlaying: !el.paused,
      }),
    );
  }, [bpm, countInBeats, timeline]);

  const tick = React.useCallback(() => {
    syncFromAudio();
    rafRef.current = window.requestAnimationFrame(tick);
  }, [syncFromAudio]);

  React.useEffect(() => {
    return () => {
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
      audioRef.current?.pause();
    };
  }, []);

  const onTogglePlay = React.useCallback(async () => {
    const el = audioRef.current;
    if (!el) return;
    try {
      if (el.paused) {
        await el.play();
        setIsPlaying(true);
        if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
        rafRef.current = window.requestAnimationFrame(tick);
      } else {
        el.pause();
        setIsPlaying(false);
        if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        syncFromAudio();
      }
    } catch {
      setIsPlaying(false);
    }
  }, [syncFromAudio, tick]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      if (e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          tag === "BUTTON" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      e.preventDefault();
      void onTogglePlay();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onTogglePlay]);

  const onStop = () => {
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    setIsPlaying(false);
    if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setCurrentTimeSec(0);
    setPhase({ kind: "idle" });
  };

  const seekTo = (timeSec: number) => {
    const el = audioRef.current;
    if (!el) return;
    const d = Number.isFinite(el.duration) ? el.duration : durationSec;
    const t = Math.max(0, d > 0 ? Math.min(timeSec, d) : timeSec);
    el.currentTime = t;
    syncFromAudio();
  };

  const onSeekBar = (barIndex: number, segmentIndex: number) => {
    const chorusIndex = phase.kind === "playing" ? phase.chorusIndex : 0;
    const t = seekTimeForSlot({
      timeline,
      barIndex,
      segmentIndex,
      chorusIndex,
      countInBeats,
      bpm,
    });
    if (t == null) return;
    seekTo(t);
  };

  const onSeekRatio = (ratio: number) => {
    seekTo(seekTimeForProgressRatio(ratio, durationSec));
  };

  const activeBarIndex =
    phase.kind === "playing" || phase.kind === "count-in" ? phase.barIndex : null;
  const activeSegmentIndex =
    phase.kind === "playing" || phase.kind === "count-in" ? phase.segmentIndex : null;
  const nowChord =
    phase.kind === "playing" || phase.kind === "count-in" ? phase.slot.chord : null;
  const nextChord =
    phase.kind === "playing" || phase.kind === "count-in" ? phase.nextSlot.chord : null;

  return (
    <div className="min-h-screen bg-zinc-50 px-3 py-6 pb-[min(48vh,22rem)] text-zinc-900 sm:px-4 sm:py-8 sm:pb-[min(52vh,28rem)] dark:bg-black dark:text-zinc-100">
      <audio
        ref={audioRef}
        src={audioSrc}
        preload="metadata"
        onLoadedMetadata={syncFromAudio}
        onEnded={() => {
          setIsPlaying(false);
          if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
          setPhase({ kind: "ended" });
          syncFromAudio();
        }}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="grid gap-2">
          <Link
            href="/"
            className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ← Songs
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {keyCenter} · {bpm} BPM · {formLabel}
          </p>
        </header>

        <ChordChart
          title="Chord Progression"
          bars={song.progression.bars}
          sections={sections}
          activeBarIndex={activeBarIndex}
          activeSegmentIndex={activeSegmentIndex}
          onSeekBar={onSeekBar}
        />

        <section className="grid gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Scale Maps</h2>
          <div className="grid gap-4">
            {uniqueChords.map((chord) => (
              <FretboardScaleMap key={chord.text} chord={chord} startFret={5} endFret={15} />
            ))}
          </div>
        </section>
      </main>

      <AudioPlayerBar
        isPlaying={isPlaying}
        currentTimeSec={currentTimeSec}
        durationSec={durationSec}
        phase={phase}
        bpm={bpm}
        nowChord={nowChord}
        nextChord={nextChord}
        activeBarIndex={activeBarIndex}
        activeSegmentIndex={activeSegmentIndex}
        onTogglePlay={() => void onTogglePlay()}
        onStop={onStop}
        onSeekRatio={onSeekRatio}
      />
    </div>
  );
}
