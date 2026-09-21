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
 * Autumn Leaves（G minor）- iReal Pro 譜面ベースの 32小節展開。
 *
 * A (×2):
 *   Cm7 | F7 | Bbmaj7 | Ebmaj7 | Am7b5 | D7b13 | Gm6 | Gm6
 * B:
 *   Am7b5 | D7b13 | Gm6 | Gm6 | Cm7 | F7 | Bbmaj7 | Ebmaj7
 * C:
 *   Am7b5 | D7b13 | Gm7 Gb7 | Fm7 E7 | Am7b5 | D7b13 | Gm6 | Gm6
 */
export const AUTUMN_LEAVES_GM_32BARS: Song = {
  id: "autumn-leaves-gm-32bars",
  title: "Autumn Leaves",
  keyCenter: "G minor",
  progression: {
    timeSignature: "4/4",
    bars: [
      // A (bars 1–8)
      barFromSymbols([["Cm7", 4]]),
      barFromSymbols([["F7", 4]]),
      barFromSymbols([["Bbmaj7", 4]]),
      barFromSymbols([["Ebmaj7", 4]]),
      barFromSymbols([["Am7b5", 4]]),
      barFromSymbols([["D7b13", 4]]),
      barFromSymbols([["Gm6", 4]]),
      barFromSymbols([["Gm6", 4]]),

      // A repeat (bars 9–16)
      barFromSymbols([["Cm7", 4]]),
      barFromSymbols([["F7", 4]]),
      barFromSymbols([["Bbmaj7", 4]]),
      barFromSymbols([["Ebmaj7", 4]]),
      barFromSymbols([["Am7b5", 4]]),
      barFromSymbols([["D7b13", 4]]),
      barFromSymbols([["Gm6", 4]]),
      barFromSymbols([["Gm6", 4]]),

      // B (bars 17–24)
      barFromSymbols([["Am7b5", 4]]),
      barFromSymbols([["D7b13", 4]]),
      barFromSymbols([["Gm6", 4]]),
      barFromSymbols([["Gm6", 4]]),
      barFromSymbols([["Cm7", 4]]),
      barFromSymbols([["F7", 4]]),
      barFromSymbols([["Bbmaj7", 4]]),
      barFromSymbols([["Ebmaj7", 4]]),

      // C (bars 25–32)
      barFromSymbols([["Am7b5", 4]]),
      barFromSymbols([["D7b13", 4]]),
      barFromSymbols([
        ["Gm7", 2],
        ["Gb7", 2],
      ]),
      barFromSymbols([
        ["Fm7", 2],
        ["E7", 2],
      ]),
      barFromSymbols([["Am7b5", 4]]),
      barFromSymbols([["D7b13", 4]]),
      barFromSymbols([["Gm6", 4]]),
      barFromSymbols([["Gm6", 4]]),
    ],
  },
};
