export type StringIndex = 0 | 1 | 2 | 3 | 4 | 5; // 0=6弦(E2) ... 5=1弦(E4)

export type GuitarPosition = {
  string: StringIndex;
  fret: number;
  midi: number;
};

// 標準チューニング（MIDI）: E2 A2 D3 G3 B3 E4
export const STANDARD_TUNING_MIDI: readonly number[] = [40, 45, 50, 55, 59, 64];

export function positionsForMidi(midi: number, maxFret: number): GuitarPosition[] {
  const out: GuitarPosition[] = [];
  for (let s = 0 as StringIndex; s <= 5; s = (s + 1) as StringIndex) {
    const open = STANDARD_TUNING_MIDI[s]!;
    const fret = midi - open;
    if (fret >= 0 && fret <= maxFret) out.push({ string: s, fret, midi });
  }
  return out;
}

export function isPlayableMidi(midi: number, maxFret: number): boolean {
  return positionsForMidi(midi, maxFret).length > 0;
}

export function midiCandidatesForPitchClass(
  pc: number, // 0..11
  minMidi: number,
  maxMidi: number,
): number[] {
  const out: number[] = [];
  for (let m = minMidi; m <= maxMidi; m += 1) {
    if (((m % 12) + 12) % 12 === ((pc % 12) + 12) % 12) out.push(m);
  }
  return out;
}

