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
 * There Will Never Be Another You（Eb）- iReal Pro 譜面ベースの ABAC 32小節。
 *
 * A: Ebmaj7 | Ebmaj7 | Dm7b5 | G7b9 | Cm7 | Cm7 | Bbm7 | Eb7
 * B: Abmaj7 | Db7#11 | Ebmaj7 | Cm7 | F7 | F7 | Fm7 | Bb7
 * A: （同じ）
 * C: Abmaj7 | Db7#11 | Ebmaj7 | Am7b5 D7 | Ebmaj7 Ab7 | Gm7 C7 | Fm7 Bb7 | Eb6 Bb7
 */
export const THERE_WILL_NEVER_BE_ANOTHER_YOU_EB_32BARS: Song = {
  id: "there-will-never-be-another-you-eb-32bars",
  title: "There Will Never Be Another You",
  keyCenter: "Eb major",
  progression: {
    timeSignature: "4/4",
    bars: [
      // A (bars 1–8)
      barFromSymbols([["Ebmaj7", 4]]),
      barFromSymbols([["Ebmaj7", 4]]),
      barFromSymbols([["Dm7b5", 4]]),
      barFromSymbols([["G7b9", 4]]),
      barFromSymbols([["Cm7", 4]]),
      barFromSymbols([["Cm7", 4]]),
      barFromSymbols([["Bbm7", 4]]),
      barFromSymbols([["Eb7", 4]]),

      // B (bars 9–16)
      barFromSymbols([["Abmaj7", 4]]),
      barFromSymbols([["Db7#11", 4]]),
      barFromSymbols([["Ebmaj7", 4]]),
      barFromSymbols([["Cm7", 4]]),
      barFromSymbols([["F7", 4]]),
      barFromSymbols([["F7", 4]]),
      barFromSymbols([["Fm7", 4]]),
      barFromSymbols([["Bb7", 4]]),

      // A (bars 17–24)
      barFromSymbols([["Ebmaj7", 4]]),
      barFromSymbols([["Ebmaj7", 4]]),
      barFromSymbols([["Dm7b5", 4]]),
      barFromSymbols([["G7b9", 4]]),
      barFromSymbols([["Cm7", 4]]),
      barFromSymbols([["Cm7", 4]]),
      barFromSymbols([["Bbm7", 4]]),
      barFromSymbols([["Eb7", 4]]),

      // C (bars 25–32)
      barFromSymbols([["Abmaj7", 4]]),
      barFromSymbols([["Db7#11", 4]]),
      barFromSymbols([["Ebmaj7", 4]]),
      barFromSymbols([
        ["Am7b5", 2],
        ["D7", 2],
      ]),
      barFromSymbols([
        ["Ebmaj7", 2],
        ["Ab7", 2],
      ]),
      barFromSymbols([
        ["Gm7", 2],
        ["C7", 2],
      ]),
      barFromSymbols([
        ["Fm7", 2],
        ["Bb7", 2],
      ]),
      barFromSymbols([
        ["Eb6", 2],
        ["Bb7", 2],
      ]),
    ],
  },
};
