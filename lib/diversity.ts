import type { PhraseCandidate, PhraseEvent } from "./generator";
import { mod12 } from "./music/notes";
import { progressionTotalEighthNotes } from "./music/progression";
import type { Song } from "./music/types";

export type PhraseFingerprint = {
  rhythmBits: string; // 0/1 の圧縮文字列
  ngram2: ReadonlySet<string>;
  ngram3: ReadonlySet<string>;
};

function eventPrimaryPc(e: PhraseEvent): number {
  if (e.kind === "note") return mod12(e.midi);
  return mod12(Math.max(...e.midis));
}

function makeRhythmBits(song: Song, candidate: PhraseCandidate): string {
  const total = progressionTotalEighthNotes(song.progression);
  const set = new Set<number>(candidate.events.map((e) => e.stepEighth));
  let bits = "";
  for (let i = 0; i < total; i += 1) bits += set.has(i) ? "1" : "0";
  return bits;
}

function makeNgrams(pcs: readonly number[], n: 2 | 3): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + n <= pcs.length; i += 1) {
    out.add(pcs.slice(i, i + n).join(","));
  }
  return out;
}

export function fingerprintPhrase(song: Song, candidate: PhraseCandidate): PhraseFingerprint {
  const pcs = candidate.events
    .slice()
    .sort((a, b) => a.stepEighth - b.stepEighth)
    .map((e) => eventPrimaryPc(e));
  return {
    rhythmBits: makeRhythmBits(song, candidate),
    ngram2: makeNgrams(pcs, 2),
    ngram3: makeNgrams(pcs, 3),
  };
}

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const uni = a.size + b.size - inter;
  return uni === 0 ? 1 : inter / uni;
}

function rhythmSimilarity(bitsA: string, bitsB: string): number {
  const len = Math.min(bitsA.length, bitsB.length);
  if (len === 0) return 1;
  let same = 0;
  for (let i = 0; i < len; i += 1) if (bitsA[i] === bitsB[i]) same += 1;
  return same / len;
}

export function phraseSimilarity(a: PhraseFingerprint, b: PhraseFingerprint): number {
  const r = rhythmSimilarity(a.rhythmBits, b.rhythmBits);
  const n2 = jaccard(a.ngram2, b.ngram2);
  const n3 = jaccard(a.ngram3, b.ngram3);
  // rhythmは一致しやすいので重み控えめ、輪郭(ngram)を重視
  return r * 0.25 + n2 * 0.35 + n3 * 0.4;
}

export function diversityFilter<T>(args: {
  items: readonly T[];
  fingerprintOf: (item: T) => PhraseFingerprint;
  maxItems: number;
  similarityThreshold: number; // 0..1: これ以上なら「似すぎ」とみなして落とす
  existingFingerprints?: readonly PhraseFingerprint[];
}): { accepted: T[]; fingerprints: PhraseFingerprint[] } {
  const {
    items,
    fingerprintOf,
    maxItems,
    similarityThreshold,
    existingFingerprints = [],
  } = args;
  const accepted: T[] = [];
  const fps: PhraseFingerprint[] = [...existingFingerprints];

  for (const item of items) {
    if (accepted.length >= maxItems) break;
    const fp = fingerprintOf(item);
    const tooSimilar = fps.some((prev) => phraseSimilarity(prev, fp) >= similarityThreshold);
    if (tooSimilar) continue;
    accepted.push(item);
    fps.push(fp);
  }

  return { accepted, fingerprints: fps };
}

