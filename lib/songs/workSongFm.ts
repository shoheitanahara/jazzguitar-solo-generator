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
 * Work Song（F minor）- iReal Pro 譜面ベースの 16小節。
 *
 * A: Fm | Fm | Fm | Fm | Fm | Fm | C7 | C7
 * B: Fm | Fm | Fm | Fm | F7 | Bb7 | G7 C7 | Fm
 */
export const WORK_SONG_FM_16BARS: Song = {
  id: "work-song-fm-16bars",
  title: "Work Song",
  keyCenter: "F minor",
  progression: {
    timeSignature: "4/4",
    bars: [
      // A (bars 1–8)
      barFromSymbols([["Fm", 4]]),
      barFromSymbols([["Fm", 4]]),
      barFromSymbols([["Fm", 4]]),
      barFromSymbols([["Fm", 4]]),
      barFromSymbols([["Fm", 4]]),
      barFromSymbols([["Fm", 4]]),
      barFromSymbols([["C7", 4]]),
      barFromSymbols([["C7", 4]]),

      // B (bars 9–16)
      barFromSymbols([["Fm", 4]]),
      barFromSymbols([["Fm", 4]]),
      barFromSymbols([["Fm", 4]]),
      barFromSymbols([["Fm", 4]]),
      barFromSymbols([["F7", 4]]),
      barFromSymbols([["Bb7", 4]]),
      barFromSymbols([
        ["G7", 2],
        ["C7", 2],
      ]),
      barFromSymbols([["Fm", 4]]),
    ],
  },
};
