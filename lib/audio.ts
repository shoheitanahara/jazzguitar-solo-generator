import * as Tone from "tone";
import type { Song } from "./music/types";

export type GuitarLikeSettings = {
  strumMinMs: number;
  strumMaxMs: number;
  reverbWet: number;
  reverbDecay: number;
  gain: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  /**
   * 0..0.9（0=ストレート, 0.6前後=強めのスイング）
   * “8分裏” を遅らせ、3連符っぽいタメを作る。
   */
  swingAmount: number;
  compSubdivision: "quarter" | "eighth";
};

const DEFAULT_SETTINGS: GuitarLikeSettings = {
  strumMinMs: 10,
  strumMaxMs: 25,
  reverbWet: 0.18,
  reverbDecay: 1.6,
  gain: 0.85,
  attack: 0.005,
  decay: 0.12,
  sustain: 0.18,
  release: 0.35,
  swingAmount: 0.6,
  compSubdivision: "eighth",
};

function clamp(min: number, x: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}

function midiNotesForChord(chord: { rootPc: number; chordToneIntervals: readonly number[] }): number[] {
  // 3〜4音の“それっぽい”ボイシング（低すぎない範囲）
  let root = 48 + chord.rootPc; // C3近辺
  while (root < 45) root += 12;
  while (root > 57) root -= 12;

  const tones = chord.chordToneIntervals.slice(0, 4).map((i) => root + i);
  // 低域の濁り回避で、必要なら5thを上げる
  return tones.map((m) => (m < 48 ? m + 12 : m));
}

function quarterSeconds(): number {
  return Tone.Time("4n").toSeconds();
}

function beatToSeconds(beats: number): number {
  return quarterSeconds() * beats;
}

function swingDelaySeconds(offsetBeats: number, swingAmount: number): number {
  const amount = clamp(0, swingAmount, 0.9);
  if (amount <= 0.0001) return 0;

  // オフビート8分（&）なら遅らせる
  const eighthIndex = Math.round(offsetBeats * 2);
  const isOffbeatEighth = Math.abs(offsetBeats * 2 - eighthIndex) < 1e-6 && eighthIndex % 2 === 1;
  if (!isOffbeatEighth) return 0;

  // ストレート(0.5拍)→スイング(2/3拍) の差 = 1/6拍
  return beatToSeconds(1 / 6) * amount;
}

function deterministic01(a: number, b: number, c: number): number {
  // 乱数依存を増やさず、毎回同じ“揺れ”を作る
  let x = (a * 374761393 + b * 668265263 + c * 2147483647) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 1274126177) >>> 0;
  return x / 4294967296;
}

function offsetsForSubdivision(beats: number, subdivision: "quarter" | "eighth"): number[] {
  const out: number[] = [];
  const step = subdivision === "eighth" ? 0.5 : 1;
  for (let b = 0; b < beats - 1e-9; b += step) out.push(Number(b.toFixed(3)));
  return out;
}

export class ChordLooper {
  private synth: Tone.PolySynth<Tone.Synth>;
  private reverb: Tone.Reverb;
  private gain: Tone.Gain;
  private song: Song | null = null;
  private settings: GuitarLikeSettings = { ...DEFAULT_SETTINGS };
  private started = false;

  constructor() {
    this.synth = new Tone.PolySynth(Tone.Synth, {
      volume: -8,
      oscillator: { type: "triangle" },
      envelope: {
        attack: DEFAULT_SETTINGS.attack,
        decay: DEFAULT_SETTINGS.decay,
        sustain: DEFAULT_SETTINGS.sustain,
        release: DEFAULT_SETTINGS.release,
      },
    });
    this.reverb = new Tone.Reverb({ decay: DEFAULT_SETTINGS.reverbDecay, wet: DEFAULT_SETTINGS.reverbWet });
    this.gain = new Tone.Gain(DEFAULT_SETTINGS.gain);
    this.synth.chain(this.reverb, this.gain, Tone.Destination);

    Tone.Transport.timeSignature = 4;
  }

  setSettings(next: Partial<GuitarLikeSettings>) {
    this.settings = { ...this.settings, ...next };
    this.reverb.decay = this.settings.reverbDecay;
    this.reverb.wet.value = clamp(0, this.settings.reverbWet, 1);
    this.gain.gain.value = clamp(0, this.settings.gain, 1.2);

    this.synth.set({
      envelope: {
        attack: this.settings.attack,
        decay: this.settings.decay,
        sustain: this.settings.sustain,
        release: this.settings.release,
      },
    });
  }

  getSettings(): GuitarLikeSettings {
    return { ...this.settings };
  }

  async start(song: Song, bpm: number) {
    this.song = song;
    Tone.Transport.bpm.value = bpm;

    // ブラウザのオーディオ制約（ユーザー操作からの start が必要）
    await Tone.start();

    this.scheduleSong(song);
    Tone.Transport.start();
    this.started = true;
  }

  stop() {
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
    this.started = false;
  }

  isStarted(): boolean {
    return this.started;
  }

  setBpm(bpm: number) {
    Tone.Transport.bpm.value = bpm;
  }

  private scheduleSong(song: Song) {
    Tone.Transport.cancel(0);

    const loopBars = song.progression.bars.length;
    Tone.Transport.loop = true;
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = `${loopBars}m`;

    for (let barIndex = 0; barIndex < song.progression.bars.length; barIndex += 1) {
      const bar = song.progression.bars[barIndex]!;
      let beat = 0;
      for (const seg of bar.segments) {
        const time = `${barIndex}:${beat}:0`;
        Tone.Transport.schedule((t) => {
          const midis = midiNotesForChord(seg.chord);
          const offsets = offsetsForSubdivision(seg.beats, this.settings.compSubdivision);
          for (let i = 0; i < offsets.length; i += 1) {
            const off = offsets[i]!;
            if (off >= seg.beats) continue;

            const nextOff = i + 1 < offsets.length ? Math.min(offsets[i + 1]!, seg.beats) : seg.beats;
            const stepBeats = Math.max(0.25, nextOff - off);
            // 8分刻みは短めに切って濁りを避ける。4分は少し長めに。
            const sustainBeats =
              this.settings.compSubdivision === "eighth"
                ? Math.max(0.20, stepBeats * 0.82)
                : Math.max(0.35, stepBeats * 0.97);
            const durationSec = beatToSeconds(sustainBeats);

            // “揺れ”と強弱（機械っぽさの軽減）
            const r = deterministic01(barIndex, beat * 10 + i, seg.chord.rootPc);
            const humanize = (r - 0.5) * 0.018; // ±9ms
            const beatIndex = (beat + off) % 4; // 0..3 (1..4拍目)
            const isBackbeat = beatIndex === 1 || beatIndex === 3; // 2拍目 / 4拍目
            const isOffbeatEighth = Math.abs(off * 2 - Math.round(off * 2)) < 1e-6 && Math.round(off * 2) % 2 === 1;

            // 2&4強調 +（8分刻みの場合）裏拍を少し強めて“ハネ”っぽさ
            const vel =
              this.settings.compSubdivision === "eighth"
                ? isBackbeat
                  ? isOffbeatEighth
                    ? 0.93
                    : 0.98
                  : isOffbeatEighth
                    ? 0.86
                    : 0.78
                : isBackbeat
                  ? 0.98
                  : 0.8;

            const backbeatLag = isBackbeat ? 0.006 : 0; // slight laid-back feel

            const swing = swingDelaySeconds(off, this.settings.swingAmount);
            this.playStrum(
              midis,
              t + beatToSeconds(off) + swing + humanize + backbeatLag,
              durationSec,
              vel,
            );
          }
        }, time);
        beat += seg.beats;
      }
    }
  }

  private playStrum(midis: readonly number[], time: number, durationSec: number, velocity: number) {
    const min = this.settings.strumMinMs / 1000;
    const max = this.settings.strumMaxMs / 1000;
    const span = Math.max(0, max - min);

    const sorted = midis.slice().sort((a, b) => a - b); // 低音→高音
    for (let i = 0; i < sorted.length; i += 1) {
      const delay = min + (sorted.length <= 1 ? 0 : (i / (sorted.length - 1)) * span);
      const freqHz = Tone.Frequency(sorted[i]!, "midi").toFrequency();
      this.synth.triggerAttackRelease(freqHz, durationSec, time + delay, velocity);
    }
  }
}

let singleton: ChordLooper | null = null;

export function getChordLooper(): ChordLooper {
  if (!singleton) singleton = new ChordLooper();
  return singleton;
}

export const DEFAULT_GUITAR_LIKE_SETTINGS = DEFAULT_SETTINGS;

