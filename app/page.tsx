"use client";

import * as React from "react";
import { TAKE_THE_A_TRAIN_C_32BARS } from "@/lib/songs/takeTheATrainC";
import { uniqueChordsInSong } from "@/lib/music/scaleMap";
import {
  buildFormTimeline,
  resolvePlaybackPosition,
  seekTimeForProgressRatio,
  seekTimeForSlot,
  type PlaybackPhase,
} from "@/lib/music/playbackTimeline";
import { ChordChart } from "@/components/ChordChart";
import { FretboardScaleMap } from "@/components/FretboardScaleMap";
import { AudioPlayerBar } from "@/components/AudioPlayerBar";

const FORM_SECTIONS = [
  { label: "A (1st ending)", startBarIndex: 0, endBarIndexExclusive: 8 },
  { label: "A (2nd ending)", startBarIndex: 8, endBarIndexExclusive: 16 },
  { label: "B", startBarIndex: 16, endBarIndexExclusive: 24 },
  { label: "A (last)", startBarIndex: 24, endBarIndexExclusive: 32 },
] as const;

/** Audio: 160 BPM, 8-count intro */
const AUDIO_SRC = "/audio/Take%20The%20A%20Train.wav";
const BPM = 160;
const COUNT_IN_BEATS = 8;

export default function Home() {
  const song = TAKE_THE_A_TRAIN_C_32BARS;
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
        bpm: BPM,
        countInBeats: COUNT_IN_BEATS,
        timeline,
        isPlaying: !el.paused,
      }),
    );
  }, [timeline]);

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

  const onTogglePlay = async () => {
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
  };

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
      countInBeats: COUNT_IN_BEATS,
      bpm: BPM,
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
    <div className="min-h-screen bg-zinc-50 px-4 py-8 pb-[min(52vh,28rem)] text-zinc-900 dark:bg-black dark:text-zinc-100">
      <audio
        ref={audioRef}
        src={AUDIO_SRC}
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
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Take the A Train</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">C · {BPM} BPM · AABA</p>
        </header>

        <ChordChart
          title="Chord Progression"
          bars={song.progression.bars}
          sections={FORM_SECTIONS}
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
        bpm={BPM}
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
