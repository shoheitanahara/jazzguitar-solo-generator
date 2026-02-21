import { mod12, noteToPitchClass, pcSetFromIntervals } from "./notes";
import type {
  Chord,
  ChordQuality,
  ChordSymbol,
  NoteSpelling,
  PitchClass,
} from "./types";

type ChordSpec = {
  chordToneIntervals: readonly number[];
  guideToneIntervals: readonly number[];
};

const CHORD_SPECS: Record<ChordQuality, ChordSpec> = {
  maj7: { chordToneIntervals: [0, 4, 7, 11], guideToneIntervals: [4, 11] },
  m7: { chordToneIntervals: [0, 3, 7, 10], guideToneIntervals: [3, 10] },
  "7": { chordToneIntervals: [0, 4, 7, 10], guideToneIntervals: [4, 10] },
  m7b5: { chordToneIntervals: [0, 3, 6, 10], guideToneIntervals: [3, 10] },
};

/**
 * MVP用の実用スケールセット。
 * - ii-V in Bb を想定し、Cm7/F7/Bbmaj7/Ebmaj7 は Bbメジャー寄り
 * - Am7b5/D7/Gm は Gマイナー解決を意識し D7にF# を含める
 */
export function defaultScaleForChord(symbol: ChordSymbol): PitchClass[] {
  // Bb major: Bb C D Eb F G A (PC: 10,0,2,3,5,7,9)
  const bbMajor: PitchClass[] = [10, 0, 2, 3, 5, 7, 9];

  // G natural minor: G A Bb C D Eb F (PC: 7,9,10,0,2,3,5)
  const gNaturalMinor: PitchClass[] = [7, 9, 10, 0, 2, 3, 5];

  // G harmonic minor: G A Bb C D Eb F# (PC: 7,9,10,0,2,3,6)
  const gHarmonicMinor: PitchClass[] = [7, 9, 10, 0, 2, 3, 6];

  // 記号ベースでざっくり分岐（拡張しやすいように別モジュール化しても良い）
  if (symbol.text === "D7") return gHarmonicMinor; // F# を含めて Gmへ解決
  if (symbol.text === "Gm") return gNaturalMinor;
  if (symbol.text === "Am7b5") return gNaturalMinor;

  // それ以外はBbメジャー寄り（Autumn Leaves 冒頭の8小節に必要な範囲）
  return bbMajor.map((pc) => pc);
}

export function parseChordSymbol(text: string): ChordSymbol {
  // 例: Cm7, F7, Bbmaj7, Ebmaj7, Am7b5, D7, Gm
  const m = text.match(/^([A-G])([b#]?)(maj7|m7b5|m7|m|7)$/);
  if (!m) throw new Error(`Unsupported chord symbol: ${text}`);
  const letter = m[1]!;
  const accidental = m[2] ?? "";
  const qualityRaw = m[3]!;

  const root = `${letter}${accidental}` as NoteSpelling;
  const quality: ChordQuality =
    qualityRaw === "m"
      ? "m7" // MVPでは m は m7扱い（この進行のGm表記対応）
      : (qualityRaw as ChordQuality);

  return { text, root, quality };
}

export function buildChord(symbol: ChordSymbol): Chord {
  const rootPc = noteToPitchClass(symbol.root);
  const spec = CHORD_SPECS[symbol.quality];
  const scalePcs = defaultScaleForChord(symbol);
  return {
    ...symbol,
    rootPc,
    chordToneIntervals: spec.chordToneIntervals,
    guideToneIntervals: spec.guideToneIntervals,
    scalePcs,
  };
}

export function chordTonePcs(chord: Chord): PitchClass[] {
  return pcSetFromIntervals(chord.rootPc, chord.chordToneIntervals);
}

export function guideTonePcs(chord: Chord): PitchClass[] {
  return pcSetFromIntervals(chord.rootPc, chord.guideToneIntervals);
}

export function chordHasPitchClass(chord: Chord, pc: PitchClass): boolean {
  return chordTonePcs(chord).includes(mod12(pc));
}

