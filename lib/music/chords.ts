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
  // Practical defaults:
  // - Keep a special case for D7 to include F# (harmonic minor color) for Gm resolution.
  // - Otherwise choose a simple mode by chord quality (works across the full form).
  //
  // This is not a full theory engine; it provides a reasonable pitch-class pool for generator fragments.

  // G natural minor: G A Bb C D Eb F (PC: 7,9,10,0,2,3,5)
  const gNaturalMinor: PitchClass[] = [7, 9, 10, 0, 2, 3, 5];
  // G harmonic minor: G A Bb C D Eb F# (PC: 7,9,10,0,2,3,6)
  const gHarmonicMinor: PitchClass[] = [7, 9, 10, 0, 2, 3, 6];

  if (symbol.text === "D7") return gHarmonicMinor;
  if (symbol.text === "Gm" || symbol.text === "Gm7") return gNaturalMinor;
  if (symbol.text === "Am7b5") return gNaturalMinor;

  const rootPc = noteToPitchClass(symbol.root);
  const modeIntervals: Record<ChordQuality, readonly number[]> = {
    // Ionian
    maj7: [0, 2, 4, 5, 7, 9, 11],
    // Dorian
    m7: [0, 2, 3, 5, 7, 9, 10],
    // Mixolydian
    "7": [0, 2, 4, 5, 7, 9, 10],
    // Locrian
    m7b5: [0, 1, 3, 5, 6, 8, 10],
  };

  const ints = modeIntervals[symbol.quality];
  return ints.map((i) => mod12(rootPc + i));
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

