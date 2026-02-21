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
 * Autumn Leaves（キーGm想定）冒頭8小節ループ（後で拡張できる設計）
 *
 * | Cm7 F7 | Bbmaj7 Ebmaj7 |
 * | Am7b5 D7 | Gm % |
 * | Cm7 F7 | Bbmaj7 Ebmaj7 |
 * | Am7b5 D7 | Gm |
 */
export const AUTUMN_LEAVES_GM_8BARS: Song = {
  id: "autumn-leaves-gm-8bars",
  title: "Autumn Leaves (8-bar loop)",
  keyCenter: "G minor",
  progression: {
    timeSignature: "4/4",
    bars: [
      barFromSymbols([
        ["Cm7", 2],
        ["F7", 2],
      ]),
      barFromSymbols([
        ["Bbmaj7", 2],
        ["Ebmaj7", 2],
      ]),
      barFromSymbols([
        ["Am7b5", 2],
        ["D7", 2],
      ]),
      barFromSymbols([["Gm", 4]]),
      barFromSymbols([
        ["Cm7", 2],
        ["F7", 2],
      ]),
      barFromSymbols([
        ["Bbmaj7", 2],
        ["Ebmaj7", 2],
      ]),
      barFromSymbols([
        ["Am7b5", 2],
        ["D7", 2],
      ]),
      barFromSymbols([["Gm", 4]]),
    ],
  },
};

