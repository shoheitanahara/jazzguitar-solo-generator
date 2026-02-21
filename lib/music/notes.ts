import type { NoteSpelling, PitchClass } from "./types";

const NOTE_TO_PC: Record<NoteSpelling, PitchClass> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

const PC_TO_SHARP: NoteSpelling[] = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

export function noteToPitchClass(note: NoteSpelling): PitchClass {
  return NOTE_TO_PC[note];
}

export function pitchClassToNote(pc: PitchClass): NoteSpelling {
  return PC_TO_SHARP[pc]!;
}

export function mod12(n: number): PitchClass {
  const m = ((n % 12) + 12) % 12;
  return m as PitchClass;
}

export function pcSetFromIntervals(
  rootPc: PitchClass,
  intervals: readonly number[],
): PitchClass[] {
  const out = new Set<PitchClass>();
  for (const i of intervals) out.add(mod12(rootPc + i));
  return [...out];
}

export function midiToName(midi: number): string {
  const pc = mod12(midi);
  const octave = Math.floor(midi / 12) - 1;
  return `${pitchClassToNote(pc)}${octave}`;
}

