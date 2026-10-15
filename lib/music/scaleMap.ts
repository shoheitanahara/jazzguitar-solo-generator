import { STANDARD_TUNING_MIDI, type StringIndex } from "../guitar";
import { mod12, noteToPitchClass } from "./notes";
import type { Chord, ChordSymbol, NoteSpelling, PitchClass, Song } from "./types";

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

export type ScaleContext = {
  /** 次のコード（解決先・続き） */
  next?: ChordSymbol | null;
  /** 曲のキー中心（ii→Dorian / vi→Aeolian 判定用） */
  keyRootPc?: PitchClass | null;
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

export type ScaleMapEntry = {
  chord: Chord;
  scale: ScaleDefinition;
  /** 例: "→ Am7" */
  hint?: string;
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

const AEOLIAN: readonly ScaleDegree[] = [
  { semitones: 0, label: "R" },
  { semitones: 2, label: "9" },
  { semitones: 3, label: "b3" },
  { semitones: 5, label: "11" },
  { semitones: 7, label: "5" },
  { semitones: 8, label: "b13" },
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

/** V7 → i（短調解決）向け */
const PHRYGIAN_DOMINANT: readonly ScaleDegree[] = [
  { semitones: 0, label: "R" },
  { semitones: 1, label: "b9" },
  { semitones: 4, label: "3" },
  { semitones: 5, label: "11" },
  { semitones: 7, label: "5" },
  { semitones: 8, label: "b13" },
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

/** "C major" / "G minor" / "Eb major" からルート PC を取る */
export function keyRootPcFromCenter(keyCenter: string): PitchClass | undefined {
  const m = keyCenter.trim().match(/^([A-G][b#]?)/);
  if (!m) return undefined;
  try {
    return noteToPitchClass(m[1]! as NoteSpelling);
  } catch {
    return undefined;
  }
}

function isPerfectFourthUp(fromPc: PitchClass, toPc: PitchClass): boolean {
  return mod12(toPc - fromPc) === 5;
}

/** 同一コードの連続を飛ばし、次に変わるコードを返す */
export function nextDistinctChord(
  chords: readonly ChordSymbol[],
  fromIndex: number,
): ChordSymbol | null {
  const current = chords[fromIndex];
  if (!current) return null;
  for (let j = fromIndex + 1; j < chords.length; j += 1) {
    const c = chords[j]!;
    if (c.text !== current.text) return c;
  }
  return null;
}

/**
 * コード記号＋前後関係から、ジャズ実用のモードを選ぶ。
 *
 * 例（All Of Me）:
 * - E7→A7: Mixolydian
 * - A7→Dm7 / E7→Am7: Phrygian Dominant
 * - Dm7 (ii): Dorian / Am7 (vi): Aeolian
 */
export function scaleDefinitionForChord(
  symbol: ChordSymbol,
  ctx: ScaleContext = {},
): ScaleDefinition {
  const root = symbol.root;
  const rootPc = noteToPitchClass(root);
  const alt = symbol.text.slice(root.length);
  const next = ctx.next ?? null;

  if (alt.includes("#11") || alt.includes("♯11")) {
    return { name: `${root} Lydian Dominant`, degrees: LYDIAN_DOMINANT };
  }
  if (/(b9|♭9|Flat\s*9)/i.test(alt)) {
    return { name: `${root} Mixolydian ♭9`, degrees: MIXOLYDIAN_B9 };
  }
  if (/(b13|♭13|Flat\s*13)/i.test(alt)) {
    return { name: `${root} Mixolydian ♭13`, degrees: MIXOLYDIAN_B13 };
  }

  // V7 → i（完全4度上のマイナー）: Phrygian Dominant
  if (
    symbol.quality === "7" &&
    next &&
    (next.quality === "m7" || next.quality === "m6") &&
    isPerfectFourthUp(rootPc, noteToPitchClass(next.root))
  ) {
    return { name: `${root} Phrygian Dominant`, degrees: PHRYGIAN_DOMINANT };
  }

  switch (symbol.quality) {
    case "maj7":
    case "6":
      return { name: `${root} Ionian`, degrees: IONIAN };
    case "m6":
      return { name: `${root} Dorian`, degrees: DORIAN };
    case "m7": {
      if (ctx.keyRootPc != null) {
        const deg = mod12(rootPc - ctx.keyRootPc);
        // vi → Aeolian, ii → Dorian
        if (deg === 9) return { name: `${root} Aeolian`, degrees: AEOLIAN };
        if (deg === 2) return { name: `${root} Dorian`, degrees: DORIAN };
      }
      return { name: `${root} Dorian`, degrees: DORIAN };
    }
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
    case "dim7":
      return {
        name: `${root} Whole-Half Dim`,
        degrees: [
          { semitones: 0, label: "R" },
          { semitones: 2, label: "9" },
          { semitones: 3, label: "b3" },
          { semitones: 5, label: "11" },
          { semitones: 6, label: "b5" },
          { semitones: 8, label: "b13" },
          { semitones: 9, label: "bb7" },
          { semitones: 11, label: "7" },
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
 * 進行を走査し、(コード × スケール) のユニーク一覧を返す。
 * 同じコードでも解決先が違えば別エントリ（例: E7 Mixolydian / E7 Phrygian Dominant）。
 */
export function uniqueScaleMapsInSong(song: Song): ScaleMapEntry[] {
  const keyRootPc = keyRootPcFromCenter(song.keyCenter);
  const flat: Chord[] = [];
  for (const bar of song.progression.bars) {
    for (const seg of bar.segments) flat.push(seg.chord);
  }

  const seen = new Set<string>();
  const out: ScaleMapEntry[] = [];
  for (let i = 0; i < flat.length; i += 1) {
    const chord = flat[i]!;
    const next = nextDistinctChord(flat, i);
    const scale = scaleDefinitionForChord(chord, { next, keyRootPc });
    const key = `${chord.text}::${scale.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      chord,
      scale,
      hint: next ? `→ ${next.text}` : undefined,
    });
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
