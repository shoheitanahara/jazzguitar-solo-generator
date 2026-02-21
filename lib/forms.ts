import type { PitchClass } from "./music/types";
import { mod12 } from "./music/notes";
import type { Rng } from "./random";

export type FormContext = {
  rng: Rng;
  startGuidePc: PitchClass;
  nextGuidePc: PitchClass;
  chordPcs: readonly PitchClass[];
  scalePcs: readonly PitchClass[];
  chromaticRate: number; // 0..1
  space: number; // 0..1 (higher -> more rests)
  lastMidi: number | null;
};

export type FormResult = {
  pcs: Array<PitchClass | null>; // length=4 (2 beats = 4 eighth notes)
  name: string;
};

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function pcDistance(a: PitchClass, b: PitchClass): number {
  const d = Math.abs(a - b);
  return Math.min(d, 12 - d);
}

function pickNearPc(rng: Rng, pool: readonly PitchClass[], target: PitchClass): PitchClass {
  if (pool.length === 0) return target;
  const scored = pool
    .map((pc) => ({ pc, d: pcDistance(pc, target) }))
    .sort((a, b) => a.d - b.d);
  const bestD = scored[0]!.d;
  const best = scored.filter((x) => x.d === bestD);
  return best[rng.int(0, best.length)]!.pc;
}

function approachTo(target: PitchClass, rng: Rng): PitchClass {
  // 半音上下
  return mod12(target + (rng.bool(0.5) ? 1 : -1));
}

function enclosureTo(target: PitchClass, rng: Rng): [PitchClass, PitchClass] {
  const up = mod12(target + (rng.bool(0.7) ? 1 : 2));
  const down = mod12(target - (rng.bool(0.7) ? 1 : 2));
  return [up, down];
}

function scaleNeighbor(scale: readonly PitchClass[], from: PitchClass, rng: Rng): PitchClass {
  // スケール内で近い音を選び、過度な跳躍を避ける
  const near = scale
    .map((pc) => ({ pc, d: pcDistance(pc, from) }))
    .filter((x) => x.d > 0 && x.d <= 2)
    .sort((a, b) => a.d - b.d);
  if (near.length) return near[rng.int(0, Math.min(near.length, 3))]!.pc;
  return pickNearPc(rng, scale, from);
}

/**
 * 2拍（8分×4）に収まる “典型フォーム” を返す。
 * - 既存の有名フレーズのコピーではなく、汎用的なジャズ語彙（ガイドトーン、アプローチ、エンクロージャ等）の組み合わせ。
 */
export function generateTwoBeatForm(ctx: FormContext): FormResult {
  const { rng, startGuidePc, nextGuidePc, chordPcs, scalePcs } = ctx;
  const c = clamp01(ctx.chromaticRate);
  const space = clamp01(ctx.space);
  const useChrom = rng.bool(c);

  const patterns: Array<() => FormResult> = [
    // Guide → (scale neighbor) → approach → next guide
    () => {
      const n1 = scaleNeighbor(scalePcs, startGuidePc, rng);
      const n2 = useChrom ? approachTo(nextGuidePc, rng) : pickNearPc(rng, scalePcs, nextGuidePc);
      return { pcs: [startGuidePc, n1, n2, nextGuidePc], name: "guide-neighbor-approach-guide" };
    },

    // Guide → enclosure → next guide (with pickup)
    () => {
      const [up, down] = enclosureTo(nextGuidePc, rng);
      return { pcs: [startGuidePc, up, down, nextGuidePc], name: "guide-enclosure-guide" };
    },

    // Chord tone arpeggio feel → approach → next guide
    () => {
      const ct1 = pickNearPc(rng, chordPcs, startGuidePc);
      const ct2 = pickNearPc(rng, chordPcs, nextGuidePc);
      const n2 = scaleNeighbor(scalePcs, ct1, rng);
      const n3 = useChrom ? approachTo(nextGuidePc, rng) : ct2;
      return { pcs: [ct1, n2, n3, nextGuidePc], name: "arp-ish-to-guide" };
    },

    // Diatonic run to next guide (less chromatic)
    () => {
      const n1 = scaleNeighbor(scalePcs, startGuidePc, rng);
      const n2 = scaleNeighbor(scalePcs, n1, rng);
      const n3 = pickNearPc(rng, scalePcs, nextGuidePc);
      return { pcs: [startGuidePc, n1, n2, n3], name: "diatonic-run" };
    },
  ];

  // Basic behavior: always end on the next guide for smoothness
  const chosen = patterns[rng.int(0, patterns.length)]!();
  chosen.pcs[3] = nextGuidePc;

  // “休符（スペース）” を作る：中間の8分を抜く（着地点は残す）
  // 休符が入ると、コードの上で“しゃべる”感じになりやすく、ジャズギターっぽさが増す。
  if (rng.bool(space)) chosen.pcs[1] = null;
  if (rng.bool(space * 0.7)) chosen.pcs[2] = null;

  // 最低限、始点/終点は残す
  chosen.pcs[0] = startGuidePc;
  chosen.pcs[3] = nextGuidePc;
  return chosen;
}

