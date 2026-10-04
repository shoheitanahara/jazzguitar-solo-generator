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
 * All Of Me（C）- iReal Pro 譜面ベースの ABAC 32小節。
 *
 * A: Cmaj7 | Cmaj7 | E7 | E7 | A7 | A7 | Dm7 | Dm7
 * B: E7 | E7 | Am7 | Am7 | D7 | D7 | Dm7 | G7
 * A: （同じ）
 * C: Fmaj7 | Fm6 | Em7 | A7 | Dm7 | G7 | C6 Ebdim7 | Dm7 G7
 */
export const ALL_OF_ME_C_32BARS: Song = {
  id: "all-of-me-c-32bars",
  title: "All Of Me",
  keyCenter: "C major",
  progression: {
    timeSignature: "4/4",
    bars: [
      // A (bars 1–8)
      barFromSymbols([["Cmaj7", 4]]),
      barFromSymbols([["Cmaj7", 4]]),
      barFromSymbols([["E7", 4]]),
      barFromSymbols([["E7", 4]]),
      barFromSymbols([["A7", 4]]),
      barFromSymbols([["A7", 4]]),
      barFromSymbols([["Dm7", 4]]),
      barFromSymbols([["Dm7", 4]]),

      // B (bars 9–16)
      barFromSymbols([["E7", 4]]),
      barFromSymbols([["E7", 4]]),
      barFromSymbols([["Am7", 4]]),
      barFromSymbols([["Am7", 4]]),
      barFromSymbols([["D7", 4]]),
      barFromSymbols([["D7", 4]]),
      barFromSymbols([["Dm7", 4]]),
      barFromSymbols([["G7", 4]]),

      // A (bars 17–24)
      barFromSymbols([["Cmaj7", 4]]),
      barFromSymbols([["Cmaj7", 4]]),
      barFromSymbols([["E7", 4]]),
      barFromSymbols([["E7", 4]]),
      barFromSymbols([["A7", 4]]),
      barFromSymbols([["A7", 4]]),
      barFromSymbols([["Dm7", 4]]),
      barFromSymbols([["Dm7", 4]]),

      // C (bars 25–32)
      barFromSymbols([["Fmaj7", 4]]),
      barFromSymbols([["Fm6", 4]]),
      barFromSymbols([["Em7", 4]]),
      barFromSymbols([["A7", 4]]),
      barFromSymbols([["Dm7", 4]]),
      barFromSymbols([["G7", 4]]),
      barFromSymbols([
        ["C6", 2],
        ["Ebdim7", 2],
      ]),
      barFromSymbols([
        ["Dm7", 2],
        ["G7", 2],
      ]),
    ],
  },
};
