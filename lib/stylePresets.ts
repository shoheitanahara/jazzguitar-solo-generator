import type { GeneratorParams, Level, Style } from "./generator";

export type StyleOption = {
  id: Style;
  label: string;
  description: string;
};

export const STYLE_OPTIONS: readonly StyleOption[] = [
  {
    id: "JoePassType",
    label: "Joe Pass Type",
    description: "Single-note lines + short chord hits for strong chord clarity.",
  },
  {
    id: "PatMartinoType",
    label: "Pat Martino Type",
    description: "Short motif repetition with more chromatic connections.",
  },
  {
    id: "JimHallType",
    label: "Jim Hall Type",
    description: "More space, guide-tone oriented, fewer big leaps.",
  },
  {
    id: "GrantGreenType",
    label: "Grant Green Type",
    description: "Singing single-note lines, more diatonic overall.",
  },
  {
    id: "ModernBebopType",
    label: "Modern Bebop Type",
    description: "Higher density with more approaches/enclosures.",
  },
  {
    id: "ChordTone4NoteType",
    label: "Chord Tone 4-Note (Chord tones only)",
    description: "Chord tones only. Simple 4-note/quarter feel. L1 stacks from low-string root; L6 varies order.",
  },
  {
    id: "BasicGuideTone",
    label: "Basic Guide Tone",
    description: "Beginner-friendly. Prioritizes 3rd/7th landings on strong beats.",
  },
];

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function clampInt(min: number, x: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(x)));
}

function levelFactor(level: Level): number {
  return (level - 1) / 5; // 0..1
}

export function styleOptionOf(style: Style): StyleOption {
  return STYLE_OPTIONS.find((s) => s.id === style) ?? STYLE_OPTIONS[0]!;
}

/**
 * UIからはパラメータを見せず、Style/Levelから自動で調整する。
 * - level↑で、音数・クロマチック率・運指レンジ・（styleに応じて）和音/モチーフ頻度が上がる
 */
export function paramsForStyle(style: Style, level: Level): GeneratorParams {
  const lf = levelFactor(level);

  const base = {
    density: 0.38,
    chromaticRate: 0.22,
    chordHitRate: 0.08,
    motifRate: 0.25,
    maxFret: 11,
    positionPreference: 7,
  };

  const byStyle: Partial<Record<Style, Partial<GeneratorParams>>> = {
    JoePassType: {
      // 8分を減らして「歌う」感じに寄せる
      density: 0.22 + 0.14 * lf,
      chromaticRate: 0.18 + 0.22 * lf,
      chordHitRate: 0.22 + 0.28 * lf,
      motifRate: 0.18 + 0.10 * lf,
      maxFret: 10 + 3 * lf,
      positionPreference: 7,
    },
    PatMartinoType: {
      density: 0.42 + 0.28 * lf,
      chromaticRate: 0.26 + 0.36 * lf,
      chordHitRate: 0.08 + 0.04 * lf, // thin chord hits even in single-note types
      motifRate: 0.55 + 0.35 * lf,
      maxFret: 12 + 3 * lf,
      positionPreference: 8,
    },
    JimHallType: {
      density: 0.22 + 0.14 * lf,
      chromaticRate: 0.10 + 0.18 * lf,
      chordHitRate: 0.16 + 0.18 * lf,
      motifRate: 0.18 + 0.08 * lf,
      maxFret: 9 + 2 * lf,
      positionPreference: 7,
    },
    GrantGreenType: {
      density: 0.24 + 0.20 * lf,
      chromaticRate: 0.10 + 0.16 * lf,
      chordHitRate: 0.06 + 0.04 * lf,
      motifRate: 0.28 + 0.22 * lf,
      maxFret: 10 + 3 * lf,
      positionPreference: 7,
    },
    ModernBebopType: {
      density: 0.50 + 0.28 * lf,
      chromaticRate: 0.35 + 0.40 * lf,
      chordHitRate: 0.05 + 0.05 * lf,
      motifRate: 0.22 + 0.18 * lf,
      maxFret: 12 + 3 * lf,
      positionPreference: 9,
    },
    ChordTone4NoteType: {
      density: 0.18 + 0.08 * lf,
      chromaticRate: 0, // strictly chord tones only
      chordHitRate: 0, // single-note only for this style
      motifRate: 0,
      maxFret: 10 + 3 * lf,
      positionPreference: 7,
    },
    BasicGuideTone: {
      density: 0.22 + 0.16 * lf,
      chromaticRate: 0.05 + 0.10 * lf,
      chordHitRate: 0.06 + 0.02 * lf,
      motifRate: 0,
      maxFret: 9 + 1 * lf,
      positionPreference: 7,
    },
  };

  const tuned = { ...base, ...(byStyle[style] ?? {}) };

  return {
    density: clamp01(tuned.density),
    chromaticRate: clamp01(tuned.chromaticRate),
    chordHitRate: clamp01(tuned.chordHitRate),
    motifRate: clamp01(tuned.motifRate),
    maxFret: clampInt(5, tuned.maxFret, 15),
    positionPreference: clampInt(1, tuned.positionPreference, 12),
  };
}

