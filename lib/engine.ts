import type { Song } from "./music/types";
import { createRng, normalizeSeed } from "./random";
import type { GeneratorParams, Level, PhraseCandidate, Style } from "./generator";
import { generatePhraseCandidate } from "./generator";
import { scoreCandidates, type ScoredCandidate } from "./scoring";
import { diversityFilter, fingerprintPhrase, type PhraseFingerprint } from "./diversity";
import { renderTab } from "./tab";
import { explainPhrase } from "./explain";

export type GeneratedItem = {
  id: string;
  score: number;
  breakdown: ScoredCandidate["breakdown"];
  tab: string;
  explanation: ReturnType<typeof explainPhrase>;
  phrase: PhraseCandidate;
  fingerprint: PhraseFingerprint;
};

export type GenerateRequest = {
  song: Song;
  style: Style;
  level: Level;
  params: GeneratorParams;
  seedText?: string;
  poolSize: number; // K
  outputSize: number; // N
  diversityThreshold?: number; // default 0.78
  existingFingerprints?: readonly PhraseFingerprint[];
};

export type GenerateResponse = {
  items: GeneratedItem[];
  fingerprints: PhraseFingerprint[];
  seed: number;
};

function sortByScoreDesc(scored: ScoredCandidate[]): ScoredCandidate[] {
  return scored.slice().sort((a, b) => b.breakdown.total - a.breakdown.total);
}

export function generateRankedTabs(req: GenerateRequest): GenerateResponse {
  const seed = normalizeSeed(req.seedText);
  const pool: PhraseCandidate[] = [];

  for (let i = 0; i < req.poolSize; i += 1) {
    // 候補ごとにseedをずらして再現性を担保
    const salted = (seed ^ Math.imul(i + 1, 0x9e3779b9)) >>> 0;
    const rng = createRng(salted);
    pool.push(
      generatePhraseCandidate({
        rng,
        song: req.song,
        style: req.style,
        level: req.level,
        params: req.params,
        seed,
        candidateIndex: i,
      }),
    );
  }

  const scored = sortByScoreDesc(scoreCandidates(req.song, pool));
  const threshold = req.diversityThreshold ?? 0.78;

  const filtered = diversityFilter({
    items: scored,
    fingerprintOf: (s) => fingerprintPhrase(req.song, s.candidate),
    maxItems: req.outputSize,
    similarityThreshold: threshold,
    existingFingerprints: req.existingFingerprints,
  });

  const items: GeneratedItem[] = filtered.accepted.map((s) => {
    const tab = renderTab(req.song, s.candidate);
    const fp = fingerprintPhrase(req.song, s.candidate);
    return {
      id: s.candidate.id,
      score: s.breakdown.total,
      breakdown: s.breakdown,
      tab: tab.tab,
      explanation: explainPhrase({ song: req.song, phrase: s.candidate, score: s.breakdown }),
      phrase: s.candidate,
      fingerprint: fp,
    };
  });

  return { items, fingerprints: filtered.fingerprints, seed };
}

