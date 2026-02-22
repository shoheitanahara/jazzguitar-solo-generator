import { buildChord, parseChordSymbol } from "../music/chords";
import type { Bar, Song } from "../music/types";

function barFromSymbols(symbols: readonly [string, number][]): Bar {
  return {
    segments: symbols.map(([sym, beats]) => ({
      chord: buildChord(parseChordSymbol(sym)),
      beats,
    })),
  };
}

/**
 * Autumn Leaves（G minor）- this project's lead-sheet variant:
 * - A (8 bars) repeated (total 16)
 * - B (16 bars)
 * => total 32 bars
 *
 * Notes:
 * - There are multiple “standard” variants across fake books/recordings.
 * - This version matches the provided lead sheet (no melody included).
 * - Time: 4/4.
 */
export const AUTUMN_LEAVES_GM_32BARS: Song = {
  id: "autumn-leaves-gm-32bars",
  title: "Autumn Leaves",
  keyCenter: "G minor",
  progression: {
    timeSignature: "4/4",
    bars: [
      // A (8) x 2
      ...Array.from({ length: 2 }).flatMap(() => [
        barFromSymbols([["Cm7", 4]]),
        barFromSymbols([["F7", 4]]),
        barFromSymbols([["Bbmaj7", 4]]),
        barFromSymbols([["Ebmaj7", 4]]),
        barFromSymbols([["Am7b5", 4]]),
        barFromSymbols([["D7", 4]]),
        barFromSymbols([["Gm", 4]]),
        barFromSymbols([["Gm", 4]]),
      ]),

      // B (16)
      barFromSymbols([["Am7b5", 4]]),
      barFromSymbols([["D7", 4]]),
      barFromSymbols([["Gm", 4]]),
      barFromSymbols([["Gm", 4]]),
      barFromSymbols([["Cm7", 4]]),
      barFromSymbols([["F7", 4]]),
      barFromSymbols([["Bbmaj7", 4]]),
      barFromSymbols([["Ebmaj7", 4]]),
      barFromSymbols([["Am7b5", 4]]),
      barFromSymbols([["D7", 4]]),
      barFromSymbols([
        ["Gm7", 2],
        ["Gb7", 2],
      ]),
      barFromSymbols([
        ["Fm7", 2],
        ["E7", 2],
      ]),
      barFromSymbols([["Am7b5", 4]]),
      barFromSymbols([["D7", 4]]),
      barFromSymbols([["Gm", 4]]),
      barFromSymbols([["Gm", 4]]),
    ],
  },
};

