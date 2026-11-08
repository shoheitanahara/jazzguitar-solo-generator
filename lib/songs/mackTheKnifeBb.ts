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
 * Mack The Knife（Bb）- iReal Pro 譜面ベースの 16小節。
 *
 * A: Bb6 | Bb6 | Cm7 | Cm7 | F7 | F7 | Bb6 | Bb6
 *    Gm7 | Gm7 | Cm7 | Cm7 | Cm7 | Cm7 F7 | Bb6 | Bb6
 */
export const MACK_THE_KNIFE_BB_16BARS: Song = {
  id: "mack-the-knife-bb-16bars",
  title: "Mack The Knife",
  keyCenter: "Bb major",
  progression: {
    timeSignature: "4/4",
    bars: [
      barFromSymbols([["Bb6", 4]]),
      barFromSymbols([["Bb6", 4]]),
      barFromSymbols([["Cm7", 4]]),
      barFromSymbols([["Cm7", 4]]),
      barFromSymbols([["F7", 4]]),
      barFromSymbols([["F7", 4]]),
      barFromSymbols([["Bb6", 4]]),
      barFromSymbols([["Bb6", 4]]),

      barFromSymbols([["Gm7", 4]]),
      barFromSymbols([["Gm7", 4]]),
      barFromSymbols([["Cm7", 4]]),
      barFromSymbols([["Cm7", 4]]),
      barFromSymbols([["Cm7", 4]]),
      barFromSymbols([
        ["Cm7", 2],
        ["F7", 2],
      ]),
      barFromSymbols([["Bb6", 4]]),
      barFromSymbols([["Bb6", 4]]),
    ],
  },
};
