import { STANDARD_TUNING_MIDI, type StringIndex } from "../guitar";
import { mod12 } from "./notes";
import type { Chord, ChordSymbol, PitchClass, Song } from "./types";

/** フレット上に表示する度数（2/4/6 は 9/11/13 表記） */
export type ScaleDegree = {
  /** ルートからの半音数 0..11 */
  semitones: number;
  label: string;
};

export type ScaleDefinition = {
  /** 表示名（例: C Ionian） */
  name: string;
  degrees: readonly ScaleDegree[];
};

export type FretboardNote = {
  string: StringIndex;
  fret: number;
  pc: PitchClass;
  label: string;
  isRoot: boolean;
  /** R / 3 / 5 / 7 などコード構成音 */
  isChordTone: boolean;
};

const IONIAN: readonly ScaleDegree[] = [
  { semitones: 0, label: "R" },
  { semitones: 2, label: "9" },
  { semitones: 4, label: "3" },
  { semitones: 5, label: "11" },
  { semitones: 7, label: "5" },
  { semitones: 9, label: "13" },
  { semitones: 11, label: "7" },
];

const DORIAN: readonly ScaleDegree[] = [
  { semitones: 0, label: "R" },
  { semitones: 2, label: "9" },
  { semitones: 3, label: "b3" },
  { semitones: 5, label: "11" },
  { semitones: 7, label: "5" },
  { semitones: 9, label: "13" },
  { semitones: 10, label: "b7" },
];

const MIXOLYDIAN: readonly ScaleDegree[] = [
  { semitones: 0, label: "R" },
  { semitones: 2, label: "9" },
  { semitones: 4, label: "3" },
  { semitones: 5, label: "11" },
  { semitones: 7, label: "5" },
  { semitones: 9, label: "13" },
  { semitones: 10, label: "b7" },
];

/** Mixolydian ♯11 / Lydian Dominant（D7#11 用） */
const LYDIAN_DOMINANT: readonly ScaleDegree[] = [
  { semitones: 0, label: "R" },
  { semitones: 2, label: "9" },
  { semitones: 4, label: "3" },
  { semitones: 6, label: "#11" },
  { semitones: 7, label: "5" },
  { semitones: 9, label: "13" },
  { semitones: 10, label: "b7" },
];

/** Mixolydian ♭9（G7b9 など） */
const MIXOLYDIAN_B9: readonly ScaleDegree[] = [
  { semitones: 0, label: "R" },
  { semitones: 1, label: "b9" },
  { semitones: 4, label: "3" },
  { semitones: 5, label: "11" },
  { semitones: 7, label: "5" },
  { semitones: 9, label: "13" },
  { semitones: 10, label: "b7" },
];

/** Mixolydian ♭13（D7b13 など） */
const MIXOLYDIAN_B13: readonly ScaleDegree[] = [
  { semitones: 0, label: "R" },
  { semitones: 2, label: "9" },
  { semitones: 4, label: "3" },
  { semitones: 5, label: "11" },
  { semitones: 7, label: "5" },
  { semitones: 8, label: "b13" },
  { semitones: 10, label: "b7" },
];

/**
 * コード記号から、ジャズ実用のモードを選ぶ。
 */
export function scaleDefinitionForChord(symbol: ChordSymbol): ScaleDefinition {
  const root = symbol.root;
  const alt = symbol.text.slice(root.length);

  if (alt.includes("#11") || alt.includes("♯11")) {
    return { name: `${root} Lydian Dominant`, degrees: LYDIAN_DOMINANT };
  }
  if (/(b9|♭9|Flat\s*9)/i.test(alt)) {
    return { name: `${root} Mixolydian ♭9`, degrees: MIXOLYDIAN_B9 };
  }
  if (/(b13|♭13|Flat\s*13)/i.test(alt)) {
    return { name: `${root} Mixolydian ♭13`, degrees: MIXOLYDIAN_B13 };
  }

  switch (symbol.quality) {
    case "maj7":
    case "6":
      return { name: `${root} Ionian`, degrees: IONIAN };
    case "m6":
    case "m7":
      return { name: `${root} Dorian`, degrees: DORIAN };
    case "7":
      return { name: `${root} Mixolydian`, degrees: MIXOLYDIAN };
    case "m7b5":
      return {
        name: `${root} Locrian`,
        degrees: [
          { semitones: 0, label: "R" },
          { semitones: 1, label: "b9" },
          { semitones: 3, label: "b3" },
          { semitones: 5, label: "11" },
          { semitones: 6, label: "b5" },
          { semitones: 8, label: "b13" },
          { semitones: 10, label: "b7" },
        ],
      };
    default: {
      const _exhaustive: never = symbol.quality;
      return _exhaustive;
    }
  }
}

/** 進行中に初めて登場する順でユニークコードを返す */
export function uniqueChordsInSong(song: Song): Chord[] {
  const seen = new Set<string>();
  const out: Chord[] = [];
  for (const bar of song.progression.bars) {
    for (const seg of bar.segments) {
      if (seen.has(seg.chord.text)) continue;
      seen.add(seg.chord.text);
      out.push(seg.chord);
    }
  }
  return out;
}

/**
 * 指定フレット範囲のスケール音位置を返す。
 * string: 0=6弦 … 5=1弦（描画時は上が1弦）
 */
export function fretboardNotesForScale(args: {
  rootPc: PitchClass;
  degrees: readonly ScaleDegree[];
  chordToneIntervals: readonly number[];
  startFret: number;
  endFret: number;
}): FretboardNote[] {
  const { rootPc, degrees, chordToneIntervals, startFret, endFret } = args;
  const byPc = new Map<PitchClass, ScaleDegree>();
  for (const d of degrees) {
    byPc.set(mod12(rootPc + d.semitones), d);
  }
  const chordTonePcs = new Set(
    chordToneIntervals.map((i) => mod12(rootPc + i)),
  );

  const notes: FretboardNote[] = [];
  for (let s = 0 as StringIndex; s <= 5; s = (s + 1) as StringIndex) {
    const openMidi = STANDARD_TUNING_MIDI[s]!;
    for (let fret = startFret; fret <= endFret; fret += 1) {
      const pc = mod12(openMidi + fret);
      const deg = byPc.get(pc);
      if (!deg) continue;
      notes.push({
        string: s,
        fret,
        pc,
        label: deg.label,
        isRoot: deg.semitones === 0,
        isChordTone: chordTonePcs.has(pc),
      });
    }
  }
  return notes;
}
