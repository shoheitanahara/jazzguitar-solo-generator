import type { Chord, Song } from "./types";

export type TimelineSlot = {
  /** フォーム先頭（カウントイン後）からの拍位置 */
  startBeat: number;
  endBeat: number;
  barIndex: number;
  segmentIndex: number;
  chord: Chord;
};

export type PlaybackPhase =
  | { kind: "idle" }
  | {
      kind: "count-in";
      countBeat: number;
      totalCountIn: number;
      /** フォーム頭のコード（カウント中から予習表示） */
      slot: TimelineSlot;
      nextSlot: TimelineSlot;
      barIndex: number;
      segmentIndex: number;
    }
  | {
      kind: "playing";
      slot: TimelineSlot;
      nextSlot: TimelineSlot;
      barIndex: number;
      segmentIndex: number;
      /** 0-based chorus index（フォーム繰り返し） */
      chorusIndex: number;
      formBeat: number;
    }
  | { kind: "ended" };

export function buildFormTimeline(song: Song): TimelineSlot[] {
  const slots: TimelineSlot[] = [];
  let beat = 0;
  song.progression.bars.forEach((bar, barIndex) => {
    bar.segments.forEach((seg, segmentIndex) => {
      slots.push({
        startBeat: beat,
        endBeat: beat + seg.beats,
        barIndex,
        segmentIndex,
        chord: seg.chord,
      });
      beat += seg.beats;
    });
  });
  return slots;
}

export function formTotalBeats(timeline: readonly TimelineSlot[]): number {
  const last = timeline[timeline.length - 1];
  return last ? last.endBeat : 0;
}

function findSlotAtBeat(
  timeline: readonly TimelineSlot[],
  formBeat: number,
): TimelineSlot {
  // formBeat は [0, total) に正規化済み想定
  for (const slot of timeline) {
    if (formBeat >= slot.startBeat && formBeat < slot.endBeat) return slot;
  }
  return timeline[timeline.length - 1]!;
}

function nextSlotAfter(
  timeline: readonly TimelineSlot[],
  slot: TimelineSlot,
): TimelineSlot {
  const idx = timeline.findIndex(
    (s) =>
      s.barIndex === slot.barIndex &&
      s.segmentIndex === slot.segmentIndex &&
      s.startBeat === slot.startBeat,
  );
  if (idx < 0) return timeline[0]!;
  return timeline[(idx + 1) % timeline.length]!;
}

/**
 * 音源の currentTime から再生位置を解決する。
 * 8カウント後にフォーム開始。複数コーラスはフォーム拍でループ。
 */
export function resolvePlaybackPosition(args: {
  currentTimeSec: number;
  durationSec: number;
  bpm: number;
  countInBeats: number;
  timeline: readonly TimelineSlot[];
  isPlaying: boolean;
}): PlaybackPhase {
  const { currentTimeSec, durationSec, bpm, countInBeats, timeline, isPlaying } = args;
  if (!isPlaying && currentTimeSec <= 0.05) return { kind: "idle" };
  if (durationSec > 0 && currentTimeSec >= durationSec - 0.05) return { kind: "ended" };
  if (timeline.length === 0) return { kind: "idle" };

  const beatsPerSec = bpm / 60;
  const absoluteBeat = currentTimeSec * beatsPerSec;

  if (absoluteBeat < countInBeats) {
    const slot = timeline[0]!;
    const nextSlot = nextSlotAfter(timeline, slot);
    return {
      kind: "count-in",
      countBeat: Math.min(countInBeats, Math.floor(absoluteBeat) + 1),
      totalCountIn: countInBeats,
      slot,
      nextSlot,
      barIndex: slot.barIndex,
      segmentIndex: slot.segmentIndex,
    };
  }

  const totalFormBeats = formTotalBeats(timeline);
  const beatIntoForm = absoluteBeat - countInBeats;
  const chorusIndex = Math.floor(beatIntoForm / totalFormBeats);
  const formBeat = ((beatIntoForm % totalFormBeats) + totalFormBeats) % totalFormBeats;
  const slot = findSlotAtBeat(timeline, formBeat);
  const nextSlot = nextSlotAfter(timeline, slot);

  return {
    kind: "playing",
    slot,
    nextSlot,
    barIndex: slot.barIndex,
    segmentIndex: slot.segmentIndex,
    chorusIndex,
    formBeat,
  };
}

/** BPM と拍位置から秒へ */
export function beatsToSeconds(beats: number, bpm: number): number {
  return beats * (60 / bpm);
}

/**
 * フォーム内の小節／セグメントへシークする秒位置。
 * chorusIndex は再生中コーラスを維持（未再生時は 0）。
 */
export function seekTimeForSlot(args: {
  timeline: readonly TimelineSlot[];
  barIndex: number;
  segmentIndex: number;
  chorusIndex: number;
  countInBeats: number;
  bpm: number;
}): number | null {
  const { timeline, barIndex, segmentIndex, chorusIndex, countInBeats, bpm } = args;
  const slot = timeline.find(
    (s) => s.barIndex === barIndex && s.segmentIndex === segmentIndex,
  );
  if (!slot) return null;
  const totalFormBeats = formTotalBeats(timeline);
  const absoluteBeat =
    countInBeats + Math.max(0, chorusIndex) * totalFormBeats + slot.startBeat;
  return beatsToSeconds(absoluteBeat, bpm);
}

/** プログレスバー比率（0..1）から秒へ */
export function seekTimeForProgressRatio(
  ratio: number,
  durationSec: number,
): number {
  if (!(durationSec > 0)) return 0;
  const r = Math.max(0, Math.min(1, ratio));
  return r * durationSec;
}
