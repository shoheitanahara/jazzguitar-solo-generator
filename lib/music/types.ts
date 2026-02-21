export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export type NoteSpelling =
  | "C"
  | "C#"
  | "Db"
  | "D"
  | "D#"
  | "Eb"
  | "E"
  | "F"
  | "F#"
  | "Gb"
  | "G"
  | "G#"
  | "Ab"
  | "A"
  | "A#"
  | "Bb"
  | "B";

export type ChordQuality = "maj7" | "m7" | "7" | "m7b5";

export type ChordSymbol = {
  /** 表示用の元テキスト（例: "Gm"） */
  text: string;
  root: NoteSpelling;
  quality: ChordQuality;
};

export type Chord = ChordSymbol & {
  /** 12平均律のピッチクラス（0=C） */
  rootPc: PitchClass;
  /** chord tones (1-3-5-7) のインターバル（半音） */
  chordToneIntervals: readonly number[];
  /** 3rd, 7th のインターバル（半音） */
  guideToneIntervals: readonly number[];
  /**
   * そのコード上での「基本スケール（ピッチクラス集合）」。
   * MVPでは候補生成の母集団として使う（厳密な理論網羅ではなく実用優先）。
   */
  scalePcs: readonly PitchClass[];
};

export type TimeSignature = "4/4";

export type ChordSegment = {
  chord: Chord;
  beats: number; // 4/4前提。2 beatsなど
};

export type Bar = {
  segments: readonly ChordSegment[];
};

export type Progression = {
  timeSignature: TimeSignature;
  bars: readonly Bar[];
};

export type Song = {
  id: string;
  title: string;
  keyCenter: string;
  progression: Progression;
};

