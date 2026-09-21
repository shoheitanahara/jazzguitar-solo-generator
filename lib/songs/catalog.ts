import type { Song } from "../music/types";
import { TAKE_THE_A_TRAIN_C_32BARS } from "./takeTheATrainC";
import { AUTUMN_LEAVES_GM_32BARS } from "./autumnLeavesGm";

export type SongSection = {
  label: string;
  startBarIndex: number;
  endBarIndexExclusive: number;
};

export type SongCatalogEntry = {
  slug: string;
  title: string;
  keyCenter: string;
  formLabel: string;
  bpm: number;
  countInBeats: number;
  audioSrc: string;
  song: Song;
  sections: readonly SongSection[];
};

export const SONG_CATALOG: readonly SongCatalogEntry[] = [
  {
    slug: "take-the-a-train",
    title: "Take the A Train",
    keyCenter: "C major",
    formLabel: "AABA",
    bpm: 160,
    countInBeats: 8,
    audioSrc: "/audio/Take%20The%20A%20Train.mp4",
    song: TAKE_THE_A_TRAIN_C_32BARS,
    sections: [
      { label: "A (1st ending)", startBarIndex: 0, endBarIndexExclusive: 8 },
      { label: "A (2nd ending)", startBarIndex: 8, endBarIndexExclusive: 16 },
      { label: "B", startBarIndex: 16, endBarIndexExclusive: 24 },
      { label: "A (last)", startBarIndex: 24, endBarIndexExclusive: 32 },
    ],
  },
  {
    slug: "autumn-leaves",
    title: "Autumn Leaves",
    keyCenter: "G minor",
    formLabel: "AABC",
    bpm: 150,
    countInBeats: 8,
    audioSrc: "/audio/Autumn%20Leaves.mp4",
    song: AUTUMN_LEAVES_GM_32BARS,
    sections: [
      { label: "A", startBarIndex: 0, endBarIndexExclusive: 8 },
      { label: "A (repeat)", startBarIndex: 8, endBarIndexExclusive: 16 },
      { label: "B", startBarIndex: 16, endBarIndexExclusive: 24 },
      { label: "C", startBarIndex: 24, endBarIndexExclusive: 32 },
    ],
  },
];

export function getSongBySlug(slug: string): SongCatalogEntry | undefined {
  return SONG_CATALOG.find((s) => s.slug === slug);
}
