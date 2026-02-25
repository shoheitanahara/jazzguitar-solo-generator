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
};

export type FormEvent = {
  /** 2 beats window: 0..3 (eighth-note offsets) */
  offsetEighth: 0 | 1 | 2 | 3;
  durationEighth: 1 | 2;
  pc: PitchClass;
};

export type FormResult = {
  events: FormEvent[];
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

  // Comping-like feel: not every beat has a note.
  // - Full rest (skip both beats): probability rises with space
  // - Beat1 only (skip beat 2): common
  // - Both beats: least likely when space is high

  // 全2拍休み: space が高いほど出やすい（コンピング的な"間"）
  const fullRest = rng.bool(space * 0.45);
  if (fullRest) return { events: [], name: "rest" };

  // Beat1 省略（Beat2 だけ鳴る）: やや珍しい
  const beat1Omit = rng.bool(space * 0.25);

  const beat2Omit = rng.bool(Math.min(0.65, space * 0.75 + 0.2));

  const beat2Pc = beat2Omit
    ? null
    : (() => {
        // choose a near chord/scale tone that leans toward the next guide
        const pool = rng.bool(0.7) ? chordPcs : scalePcs;
        const candidate = pickNearPc(rng, pool, nextGuidePc);
        // 同小節内の同音連続を避ける: beat1と同一なら別の音を優先
        if (candidate === startGuidePc && pool.length >= 2) {
          const other = pool.filter((pc) => pc !== startGuidePc);
          if (other.length) return pickNearPc(rng, other, nextGuidePc);
        }
        return candidate;
      })();

  const events: FormEvent[] = [];

  if (beat1Omit) {
    // Beat 2 だけ鳴らす（シンコペーション的な効果）
    if (beat2Pc != null) {
      events.push({ offsetEighth: 2, durationEighth: 2, pc: beat2Pc });
    }
    return { events, name: "beat2-only" };
  }

  // Beat 1 anchor
  events.push({ offsetEighth: 0, durationEighth: 2, pc: startGuidePc });

  if (beat2Pc != null) {
    // Beat 2 anchor (usually quarter)
    events.push({ offsetEighth: 2, durationEighth: 2, pc: beat2Pc });

    // Optional embellishment (rare): split beat2 into two eighths to approach next guide
    const allowLateApproach = rng.bool(clamp01(c * 0.45)) && !rng.bool(space);
    if (allowLateApproach) {
      const approach = useChrom ? approachTo(nextGuidePc, rng) : pickNearPc(rng, scalePcs, nextGuidePc);
      // replace beat2 quarter with two eighths
      events.pop();
      events.push({ offsetEighth: 2, durationEighth: 1, pc: beat2Pc });
      events.push({ offsetEighth: 3, durationEighth: 1, pc: approach });
      return { events, name: "quarter-base-late-approach" };
    }
  } else {
    // If beat2 is a rest, optional early embellishment (still rare)
    const allowEarly = rng.bool(clamp01(c * 0.35)) && rng.bool(0.5);
    if (allowEarly) {
      const n1 = useChrom ? approachTo(startGuidePc, rng) : scaleNeighbor(scalePcs, startGuidePc, rng);
      events[0] = { offsetEighth: 0, durationEighth: 1, pc: startGuidePc };
      events.push({ offsetEighth: 1, durationEighth: 1, pc: n1 });
      return { events, name: "quarter-base-early-embellish" };
    }
  }

  return { events, name: "quarter-base" };
}

