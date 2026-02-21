export type Rng = {
  next: () => number; // [0, 1)
  int: (minInclusive: number, maxExclusive: number) => number;
  pick: <T>(items: readonly T[]) => T;
  bool: (trueProbability: number) => boolean;
};

/**
 * 軽量で再現性のあるPRNG（Mulberry32）。
 * 依存を増やさず、seed指定で同じフレーズを再生成できるようにする。
 */
export function createRng(seed: number): Rng {
  // JSのnumberは53bitだが、ここでは32bitとして扱う
  let t = seed >>> 0;

  const next = () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    // 0..1
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };

  const int = (minInclusive: number, maxExclusive: number) => {
    if (!Number.isFinite(minInclusive) || !Number.isFinite(maxExclusive)) {
      throw new Error("int(): min/max must be finite");
    }
    if (maxExclusive <= minInclusive) {
      throw new Error("int(): maxExclusive must be > minInclusive");
    }
    return Math.floor(next() * (maxExclusive - minInclusive)) + minInclusive;
  };

  const pick = <T,>(items: readonly T[]) => {
    if (items.length === 0) throw new Error("pick(): empty items");
    return items[int(0, items.length)];
  };

  const bool = (trueProbability: number) => next() < trueProbability;

  return { next, int, pick, bool };
}

export function normalizeSeed(seedText: string | undefined): number {
  if (!seedText) return 123456789;
  // 数値ならそのまま、文字列なら簡易ハッシュ
  const asNumber = Number(seedText);
  if (Number.isFinite(asNumber)) return (asNumber | 0) >>> 0;

  let h = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 123456789;
}

