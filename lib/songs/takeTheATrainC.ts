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
 * Take the A Train（C）- iReal Pro 譜面ベースの AABA 32小節展開。
 *
 * A（1st ending）:
 *   C6 | C6 | D7#11 | D7#11 | Dm7 | G7 | C6 | Dm7 G7
 * A（2nd ending）:
 *   C6 | C6 | D7#11 | D7#11 | Dm7 | G7 | C6 | Gm7 C7
 * B:
 *   Fmaj7×4 | D7 | D7 | Dm7 | G7 G7b9
 * A（last）:
 *   C6 | C6 | D7#11 | D7#11 | Dm7 | G7 | C6 | Dm7 G7
 */
export const TAKE_THE_A_TRAIN_C_32BARS: Song = {
  id: "take-the-a-train-c-32bars",
  title: "Take the A Train",
  keyCenter: "C major",
  progression: {
    timeSignature: "4/4",
    bars: [
      // A — 1st ending (bars 1–8)
      barFromSymbols([["C6", 4]]),
      barFromSymbols([["C6", 4]]),
      barFromSymbols([["D7#11", 4]]),
      barFromSymbols([["D7#11", 4]]),
      barFromSymbols([["Dm7", 4]]),
      barFromSymbols([["G7", 4]]),
      barFromSymbols([["C6", 4]]),
      barFromSymbols([
        ["Dm7", 2],
        ["G7", 2],
      ]),

      // A — 2nd ending (bars 9–16)
      barFromSymbols([["C6", 4]]),
      barFromSymbols([["C6", 4]]),
      barFromSymbols([["D7#11", 4]]),
      barFromSymbols([["D7#11", 4]]),
      barFromSymbols([["Dm7", 4]]),
      barFromSymbols([["G7", 4]]),
      barFromSymbols([["C6", 4]]),
      barFromSymbols([
        ["Gm7", 2],
        ["C7", 2],
      ]),

      // B (bars 17–24)
      barFromSymbols([["Fmaj7", 4]]),
      barFromSymbols([["Fmaj7", 4]]),
      barFromSymbols([["Fmaj7", 4]]),
      barFromSymbols([["Fmaj7", 4]]),
      barFromSymbols([["D7", 4]]),
      barFromSymbols([["D7", 4]]),
      barFromSymbols([["Dm7", 4]]),
      barFromSymbols([
        ["G7", 2],
        ["G7b9", 2],
      ]),

      // A — last (bars 25–32)
      barFromSymbols([["C6", 4]]),
      barFromSymbols([["C6", 4]]),
      barFromSymbols([["D7#11", 4]]),
      barFromSymbols([["D7#11", 4]]),
      barFromSymbols([["Dm7", 4]]),
      barFromSymbols([["G7", 4]]),
      barFromSymbols([["C6", 4]]),
      barFromSymbols([
        ["Dm7", 2],
        ["G7", 2],
      ]),
    ],
  },
};
