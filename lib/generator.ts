import type { Song } from "./music/types";
import type { PitchClass } from "./music/types";
import { chordAtStep, EIGHTH_NOTES_PER_BAR, progressionTotalEighthNotes } from "./music/progression";
import { chordTonePcs, guideTonePcs } from "./music/chords";
import { mod12 } from "./music/notes";
import { isPlayableMidi, midiCandidatesForPitchClass, positionsForMidi } from "./guitar";
import type { Rng } from "./random";
import { generateTwoBeatForm } from "./forms";

export type Style =
  | "JoePassType"
  | "PatMartinoType"
  | "JimHallType"
  | "GrantGreenType"
  | "ModernBebopType"
  | "BasicGuideTone";

export type Level = 1 | 2 | 3 | 4 | 5;

export type GeneratorParams = {
  density: number; // 0..1
  chromaticRate: number; // 0..1
  chordHitRate: number; // 0..1 (JoePassType寄り)
  motifRate: number; // 0..1 (MartinoType寄り)
  maxFret: number; // ex: 7..15
  positionPreference: number; // ex: 5..9 (中心フレット)
};

export type NoteEvent = {
  kind: "note";
  stepEighth: number; // 0..(total-1)
  durationEighth: number; // 1..8
  midi: number;
};

export type ChordHitEvent = {
  kind: "chordHit";
  stepEighth: number;
  durationEighth: number;
  midis: readonly number[]; // 2..4 notes
};

export type PhraseEvent = NoteEvent | ChordHitEvent;

export type PhraseCandidate = {
  id: string;
  style: Style;
  level: Level;
  params: GeneratorParams;
  seed: number;
  events: readonly PhraseEvent[];
};

type Motif = {
  intervalsSemitone: readonly number[]; // relative movement
  length: number; // 2..4
};

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function levelFactor(level: Level): number {
  return (level - 1) / 4; // 0..1
}

type StyleProfile = {
  chordHits: boolean;
  motif: boolean;
  guideToneStrict: boolean;
};

function styleProfile(style: Style): StyleProfile {
  switch (style) {
    case "JoePassType":
      return { chordHits: true, motif: false, guideToneStrict: false };
    case "PatMartinoType":
      return { chordHits: false, motif: true, guideToneStrict: false };
    case "JimHallType":
      return { chordHits: true, motif: false, guideToneStrict: true };
    case "GrantGreenType":
      return { chordHits: false, motif: false, guideToneStrict: false };
    case "ModernBebopType":
      return { chordHits: false, motif: false, guideToneStrict: false };
    case "BasicGuideTone":
      return { chordHits: false, motif: false, guideToneStrict: true };
    default: {
      // exhaustive
      const _never: never = style;
      return _never;
    }
  }
}

function rhythmicSlotsForBar(): readonly number[] {
  // “4つ打ち（4分中心）” を固定の骨格にする。
  // 8分の装飾は forms 側が “最大1音” の範囲で生成する。
  return [0, 2, 4, 6] as const;
}

// 強拍ルールは生成の内部ロジックに直接埋め込み、現段階では別データとして保持しない。

type LastPosition = { string: number; fret: number };

function chooseMidiNearLastPosition(args: {
  rng: Rng;
  pc: PitchClass;
  maxFret: number;
  positionPreference: number;
  lastMidi: number | null;
  lastPos: LastPosition | null;
  // beat strength: true -> prefer stable position, fewer leaps
  strong: boolean;
}): { midi: number; pos: LastPosition | null } {
  const { rng, pc, maxFret, positionPreference, lastMidi, lastPos, strong } = args;

  // Playable MIDI candidates (keep range guitar-friendly)
  const minMidi = 52; // E3
  const maxMidi = 76; // E5
  const candidates = midiCandidatesForPitchClass(pc, minMidi, maxMidi).filter((m) =>
    isPlayableMidi(m, maxFret),
  );
  const pool =
    candidates.length > 0
      ? candidates
      : midiCandidatesForPitchClass(pc, 40, 88).filter((m) => isPlayableMidi(m, maxFret));
  if (pool.length === 0) return { midi: 64, pos: null };

  const bestPosCost = (midi: number): { pos: LastPosition | null; cost: number } => {
    const positions = positionsForMidi(midi, maxFret);
    if (positions.length === 0) return { pos: null, cost: Number.POSITIVE_INFINITY };

    const scored = positions.map((p) => {
      const fretDist = Math.abs(p.fret - positionPreference);
      const toLastFret = lastPos ? Math.abs(p.fret - lastPos.fret) : 0;
      const toLastString = lastPos ? Math.abs(p.string - lastPos.string) : 0;
      // Strong beats: especially avoid string jumps / big shifts.
      const moveCost = strong ? toLastString * 2.6 + toLastFret * 1.1 : toLastString * 2.0 + toLastFret * 0.85;
      const positionCost = fretDist * 0.7;
      return { p, cost: moveCost + positionCost };
    });
    scored.sort((a, b) => a.cost - b.cost);
    return { pos: scored[0]!.p, cost: scored[0]!.cost };
  };

  const scored = pool
    .map((m) => {
      const { pos, cost: posCost } = bestPosCost(m);
      const leap = lastMidi == null ? 0 : Math.abs(m - lastMidi);
      const leapCost = (strong ? 0.55 : 0.35) * leap;
      return { m, pos, score: posCost + leapCost };
    })
    .sort((a, b) => a.score - b.score);

  const take = Math.min(5, scored.length);
  const chosen = scored[rng.int(0, take)]!;
  return { midi: chosen.m, pos: chosen.pos };
}

function pcDistance(a: PitchClass, b: PitchClass): number {
  const d = Math.abs(a - b);
  return Math.min(d, 12 - d);
}

function computeGuideTargets(song: Song, rng: Rng): Map<number, PitchClass> {
  // 強拍（1拍目/3拍目）ごとに、前後の距離が最小になるようガイドトーンを選ぶ
  const total = progressionTotalEighthNotes(song.progression);
  const strongSteps: number[] = [];
  for (let step = 0; step < total; step += 1) {
    const inBar = step % EIGHTH_NOTES_PER_BAR;
    if (inBar === 0 || inBar === 4) strongSteps.push(step);
  }

  const targets = new Map<number, PitchClass>();
  let prev: PitchClass | null = null;

  for (const step of strongSteps) {
    const chord = chordAtStep(song.progression, step);
    const guides = guideTonePcs(chord);
    if (prev == null) {
      // 初回はランダムに決める（seedで再現）
      const first = guides[rng.int(0, guides.length)]!;
      targets.set(step, first);
      prev = first;
      continue;
    }
    const scored = guides
      .map((pc) => ({ pc, dist: pcDistance(prev!, pc) }))
      .sort((a, b) => a.dist - b.dist);
    // 同点は少しランダムに揺らす
    const bestDist = scored[0]!.dist;
    const bests = scored.filter((x) => x.dist === bestDist);
    const chosen = bests[rng.int(0, bests.length)]!.pc;
    targets.set(step, chosen);
    prev = chosen;
  }
  return targets;
}

function choosePcNearLast(args: {
  rng: Rng;
  pool: readonly PitchClass[];
  lastMidi: number | null;
}): PitchClass {
  const { rng, pool, lastMidi } = args;
  if (pool.length === 0) return 0;
  if (lastMidi == null) return pool[rng.int(0, pool.length)]!;

  const lastPc = mod12(lastMidi);
  // 近いPC（±2）を優先
  const near = pool.filter((pc) => pcDistance(pc, lastPc) <= 2);
  if (near.length) return near[rng.int(0, near.length)]!;

  // 次点: 最短距離
  const scored = pool
    .map((pc) => ({ pc, dist: pcDistance(pc, lastPc) }))
    .sort((a, b) => a.dist - b.dist);
  const bestDist = scored[0]!.dist;
  const bests = scored.filter((x) => x.dist === bestDist);
  return bests[rng.int(0, bests.length)]!.pc;
}

function buildMotif(rng: Rng, level: Level): Motif {
  const lf = levelFactor(level);
  const length = (rng.bool(0.5) ? 3 : 2) + (lf > 0.6 && rng.bool(0.4) ? 1 : 0);

  const intervals: number[] = [];
  for (let i = 0; i < length - 1; i += 1) {
    // MartinoType想定: 2度/3度中心、時々半音
    const options = lf > 0.5 ? [-2, -1, 1, 2, 3, -3] : [-2, -1, 1, 2];
    intervals.push(options[rng.int(0, options.length)]!);
  }
  return { intervalsSemitone: intervals, length };
}

function applyMotifFromStartPc(startPc: PitchClass, motif: Motif): PitchClass[] {
  const pcs: PitchClass[] = [startPc];
  let cur = startPc;
  for (const i of motif.intervalsSemitone) {
    cur = mod12(cur + i);
    pcs.push(cur);
  }
  return pcs;
}

function chordHitMidis(
  rng: Rng,
  chord: { rootPc: PitchClass; scalePcs: readonly PitchClass[]; text: string },
  chordPcs: readonly PitchClass[],
  maxFret: number,
  positionPreference: number,
  lastPos: LastPosition | null,
): { midis: number[]; anchorPos: LastPosition } | null {
  // 2〜4音。まずは triad + 7th を優先しつつ「押さえられる形」しか採用しない。
  const desiredCount = rng.pick([2, 3, 3, 4] as const);
  const pcsPool = [...chordPcs];

  const picked: PitchClass[] = [];
  // 低音を含めるため、rootを優先的に入れる（ジャズギターのコンピング感）
  const rootPc = chord.rootPc;
  picked.push(rootPc);
  const rootIdx = pcsPool.indexOf(rootPc);
  if (rootIdx >= 0) pcsPool.splice(rootIdx, 1);
  while (picked.length < desiredCount && pcsPool.length) {
    picked.push(pcsPool.splice(rng.int(0, pcsPool.length), 1)[0]!);
  }
  if (picked.length < 2) return null;

  // 各PCのmidi候補（ポジション寄り）を少数列挙
  const perPcMidi: number[][] = picked.map((pc, idx) => {
    // bass候補は低めに寄せ、上声は中域へ
    const isBass = idx === 0;
    const minMidi = isBass ? 38 : 52; // D2 / E3
    const maxMidi = isBass ? 58 : 76; // Bb3 / E5
    const candidates = midiCandidatesForPitchClass(pc, minMidi, maxMidi)
      .filter((m) => isPlayableMidi(m, maxFret))
      .map((m) => {
        const pos = positionsForMidi(m, maxFret);
        const best = pos
          .map((p) => {
            const fretDist = Math.abs(p.fret - positionPreference);
            const toLastFret = lastPos ? Math.abs(p.fret - lastPos.fret) : 0;
            const toLastString = lastPos ? Math.abs(p.string - lastPos.string) : 0;
            const lowStringBias = isBass ? p.string * 0.9 : 0; // bassほど低弦を強く好む
            const moveCost = toLastString * 2.2 + toLastFret * 0.9;
            return { p, cost: fretDist * 0.55 + moveCost * 0.6 + lowStringBias };
          })
          .sort((a, b) => a.cost - b.cost)[0]!;
        return { m, cost: best.cost + (isBass ? (m - 38) * 0.02 : 0) };
      })
      .sort((a, b) => a.cost - b.cost)
      .slice(0, 4)
      .map((x) => x.m);

    // フォールバック
    if (candidates.length) return candidates;
    return [
      chooseMidiNearLastPosition({
        rng,
        pc,
        maxFret,
        positionPreference,
        lastMidi: null,
        lastPos: null,
        strong: false,
      }).midi,
    ];
  });

  // 「押さえられる」判定: 隣接弦・フレット幅小・弦幅小の組み合わせが存在するか
  type Shape = { midis: number[]; cost: number; anchorPos: LastPosition };
  const shapes: Shape[] = [];

  const dfs = (idx: number, acc: number[]) => {
    if (idx >= perPcMidi.length) {
      const uniq = new Set(acc);
      if (uniq.size !== acc.length) return;
      const shape = bestPlayableChordShape(acc, maxFret, positionPreference, lastPos);
      if (shape) shapes.push(shape);
      return;
    }
    for (const m of perPcMidi[idx]!) dfs(idx + 1, [...acc, m]);
  };
  dfs(0, []);

  if (shapes.length === 0) return null;
  shapes.sort((a, b) => a.cost - b.cost);
  const best = shapes[Math.min(rng.int(0, Math.min(3, shapes.length)), shapes.length - 1)]!;
  return { midis: best.midis.sort((a, b) => a - b), anchorPos: best.anchorPos };
}

function bestPlayableChordShape(
  midis: readonly number[],
  maxFret: number,
  posPref: number,
  lastPos: LastPosition | null,
): { midis: number[]; cost: number; anchorPos: LastPosition } | null {
  const perNote = midis.map((m) =>
    positionsForMidi(m, maxFret)
      .slice()
      .sort((a, b) => Math.abs(a.fret - posPref) - Math.abs(b.fret - posPref))
      .slice(0, 4),
  );
  if (perNote.some((x) => x.length === 0)) return null;

  const combos: { midis: number[]; frets: number[]; strings: number[] }[] = [];
  const dfs = (idx: number, accPos: { midi: number; fret: number; string: number }[]) => {
    if (idx >= perNote.length) {
      const midisOut = accPos.map((p) => p.midi);
      const frets = accPos.map((p) => p.fret);
      const strings = accPos.map((p) => p.string);
      combos.push({ midis: midisOut, frets, strings });
      return;
    }
    for (const p of perNote[idx]!) {
      if (accPos.some((a) => a.string === p.string)) continue;
      dfs(idx + 1, [...accPos, { midi: p.midi, fret: p.fret, string: p.string }]);
    }
  };
  dfs(0, []);

  const playable = combos
    .map((c) => {
      const minF = Math.min(...c.frets);
      const maxF = Math.max(...c.frets);
      const minS = Math.min(...c.strings);
      const maxS = Math.max(...c.strings);
      const fretSpan = maxF - minF;
      const stringSpan = maxS - minS;
      const sortedStrings = [...c.strings].sort((a, b) => a - b);
      const contiguous = sortedStrings.every((s, i) => i === 0 || s - sortedStrings[i - 1]! === 1);
      if (!contiguous) return null;
      if (fretSpan > 4) return null;
      if (stringSpan > 3) return null;

      const avgF = c.frets.reduce((a, b) => a + b, 0) / c.frets.length;
      const toLast =
        lastPos == null
          ? 0
          : Math.abs(avgF - lastPos.fret) * 0.55 + Math.abs((minS + maxS) / 2 - lastPos.string) * 1.25;
      const bassString = Math.min(...c.strings);
      const cost =
        fretSpan * 1.4 +
        stringSpan * 0.9 +
        Math.abs(avgF - posPref) * 0.25 +
        toLast +
        bassString * 0.35; // 低弦寄りをほんのり優先

      // anchor: bass note position (lowest string, then lowest fret)
      const anchor = c.strings
        .map((s, i) => ({ string: s, fret: c.frets[i]!, midi: c.midis[i]! }))
        .sort((a, b) => a.string - b.string || a.fret - b.fret)[0]!;
      return { midis: c.midis, cost, anchorPos: { string: anchor.string, fret: anchor.fret } };
    })
    .filter(
      (x): x is { midis: number[]; cost: number; anchorPos: LastPosition } => x != null,
    )
    .sort((a, b) => a.cost - b.cost);

  return playable[0] ?? null;
}

export function generatePhraseCandidate(args: {
  rng: Rng;
  song: Song;
  style: Style;
  level: Level;
  params: GeneratorParams;
  seed: number;
  candidateIndex: number;
}): PhraseCandidate {
  const { rng, song, style, level, params, seed, candidateIndex } = args;
  const total = progressionTotalEighthNotes(song.progression);
  const profile = styleProfile(style);
  const guideTargets = computeGuideTargets(song, rng);

  const events: PhraseEvent[] = [];
  let lastMidi: number | null = null;
  let lastPos: LastPosition | null = null;
  const occupied = new Set<number>();
  const starts = new Set<number>();
  const blockedStarts = new Set<number>(); // prevent 8th-note starts adjacent to chord hits

  const occupy = (startStep: number, durationEighth: number) => {
    for (let i = 0; i < durationEighth; i += 1) occupied.add(startStep + i);
  };
  const blockAdjacentEighthStarts = (startStep: number, durationEighth: number) => {
    // “8分音符” は odd step にしか置かない方針なので、和音の前後の odd step だけブロックする。
    const before = startStep - 1;
    const after = startStep + durationEighth;
    if (before >= 0 && before % 2 === 1) blockedStarts.add(before);
    if (after % 2 === 1) blockedStarts.add(after);
  };

  // モチーフ（候補ごとに固定して反復しやすくする）
  const motif =
    profile.motif && rng.bool(clamp01(params.motifRate)) ? buildMotif(rng, level) : null;

  for (let bar = 0; bar < song.progression.bars.length; bar += 1) {
    const barStart = bar * EIGHTH_NOTES_PER_BAR;

    // 4分中心スロット（0,2,4,6）を骨格に、フォームで“最大1音”の8分装飾だけを許可する。
    const slots = rhythmicSlotsForBar();

    // 全styleで「薄い chord hit」を入れる余地を作る（JoePass/JimHallはやや多め）
    const baseChordHitRate = clamp01(params.chordHitRate * (profile.chordHits ? 1.0 : 0.7));
    const chordHitSteps = new Set<number>();
    for (const localStep of [2, 6] as const) {
      const step = barStart + localStep;
      if (step >= total) continue;
      if (!rng.bool(baseChordHitRate * 0.55)) continue;
      chordHitSteps.add(step);
    }

    // 2拍単位(=4 eighth)でフォーム生成: start(0)->next strong(4) / start(4)->next bar strong
    for (const startLocal of [0, 4] as const) {
      const startStep = barStart + startLocal;
      const nextStrongStep = startStep + 4;
      if (startStep >= total) continue;
      if (nextStrongStep > total) continue;

      // chord hit が絡む場合はフォームの8分装飾を抑制（前後に置けないため）
      const blocksDecoration =
        chordHitSteps.has(startStep + 2) ||
        chordHitSteps.has(startStep + 6) ||
        occupied.has(startStep + 1) ||
        occupied.has(startStep + 3);

      const startChord = chordAtStep(song.progression, startStep);
      const nextChord = chordAtStep(song.progression, Math.min(nextStrongStep, total - 1));
      const startGuide = guideTargets.get(startStep) ?? rng.pick(guideTonePcs(startChord));
      const nextGuide = guideTargets.get(nextStrongStep) ?? rng.pick(guideTonePcs(nextChord));

      const space =
        profile.guideToneStrict
          ? Math.max(0.25, 0.7 - params.density)
          : Math.max(0.15, 0.6 - params.density);

      const form = generateTwoBeatForm({
        rng,
        startGuidePc: startGuide,
        nextGuidePc: nextGuide,
        chordPcs: chordTonePcs(startChord),
        scalePcs: startChord.scalePcs,
        chromaticRate: blocksDecoration ? Math.min(0.1, params.chromaticRate) : params.chromaticRate,
        space,
      });

      for (const fe of form.events) {
        const step = startStep + fe.offsetEighth;
        if (step >= total) continue;
        if (blockedStarts.has(step)) continue;
        if (occupied.has(step)) continue;
        if (chordHitSteps.has(step) || chordHitSteps.has(step - 1) || chordHitSteps.has(step + 1)) continue;

        const strong = isStrongStep(step);
        const { midi, pos } = chooseMidiNearLastPosition({
          rng,
          pc: fe.pc,
          maxFret: params.maxFret,
          positionPreference: params.positionPreference,
          lastMidi,
          lastPos,
          strong,
        });
        events.push({ kind: "note", stepEighth: step, durationEighth: fe.durationEighth, midi });
        starts.add(step);
        occupy(step, fe.durationEighth);
        lastMidi = midi;
        if (pos) lastPos = pos;
      }
    }

    // chord hits: occupy first so later notes won't collide
    for (const step of chordHitSteps) {
      if (step >= total) continue;
      if (blockedStarts.has(step)) continue;
      if (starts.has(step - 1)) continue; // avoid 8th right before
      if (occupied.has(step) || occupied.has(step + 1)) continue;
      const chord = chordAtStep(song.progression, step);
      const hit = chordHitMidis(
        rng,
        chord,
        chordTonePcs(chord),
        params.maxFret,
        params.positionPreference,
        lastPos,
      );
      if (!hit) continue;
      const dur = 2;
      events.push({ kind: "chordHit", stepEighth: step, durationEighth: dur, midis: hit.midis });
      starts.add(step);
      occupy(step, dur);
      blockAdjacentEighthStarts(step, dur);
      lastPos = hit.anchorPos;
      lastMidi = Math.max(...hit.midis);
    }

    // モチーフ/追加補完は “4つ打ちスロット” のみ。8分連打は禁止（motifは2音までに制限）。
    for (const localStep of slots) {
      const step = barStart + localStep;
      if (step >= total) continue;
      if (blockedStarts.has(step)) continue;
      if (occupied.has(step)) continue;

      const chord = chordAtStep(song.progression, step);
      const chordPcs = chordTonePcs(chord);
      const guides = guideTonePcs(chord);

      const isStrong = localStep === 0 || localStep === 4;
      const isD7 = chord.text === "D7";

      // chord hit は既に確保済み
      if (chordHitSteps.has(step)) continue;

      // 骨格: 強拍は guide tones を最優先（BasicGuideToneは特に固く）
      let targetPc: PitchClass;
      if (isStrong) {
        const guidePlanned = guideTargets.get(step);
        const prefer = profile.guideToneStrict ? guides : rng.bool(0.85) ? guides : chordPcs;
        // D7ではF#を混ぜる（強拍の候補として扱う）
        if (isD7 && rng.bool(0.65 + 0.05 * (level - 1))) {
          targetPc = 6; // F#
        } else if (guidePlanned != null && prefer === guides) {
          targetPc = guidePlanned;
        } else {
          targetPc = rng.pick(prefer);
        }
      } else {
        // 弱拍: スケール断片 or chord tone をベースに、クロマチックを混ぜる
        const basePool = rng.bool(0.6) ? chordPcs : chord.scalePcs;
        targetPc = choosePcNearLast({ rng, pool: basePool, lastMidi });
        // D7上ではF#を一定確率でねじ込む（弱拍でもOK）
        if (isD7 && rng.bool(0.35 * clamp01(params.chromaticRate))) targetPc = 6;
      }

      // モチーフを挿入（強拍付近で開始しやすい）
      if (motif && rng.bool(clamp01(params.motifRate)) && (isStrong || rng.bool(0.35))) {
        // 4分中心を崩さない: 2音だけ（次の4分で続きは書かない）
        const pcs = applyMotifFromStartPc(targetPc, motif).slice(0, 2);
        const pc = pcs[0]!;
        const { midi, pos } = chooseMidiNearLastPosition({
          rng,
          pc,
          maxFret: params.maxFret,
          positionPreference: params.positionPreference,
          lastMidi,
          lastPos,
          strong: isStrong,
        });
        events.push({ kind: "note", stepEighth: step, durationEighth: 2, midi });
        occupy(step, 2);
        lastMidi = midi;
        if (pos) lastPos = pos;
        continue;
      }

      const { midi, pos } = chooseMidiNearLastPosition({
        rng,
        pc: targetPc,
        maxFret: params.maxFret,
        positionPreference: params.positionPreference,
        lastMidi,
        lastPos,
        strong: isStrong,
      });
      events.push({ kind: "note", stepEighth: step, durationEighth: 2, midi });
      starts.add(step);
      occupy(step, 2);
      lastMidi = midi;
      if (pos) lastPos = pos;
    }
  }

  // 重複stepをまとめる（装飾で前に食い込むため）
  const normalized = normalizeEvents(events, song, style, params.maxFret);

  // ルール: D7上にF#を含める（生成に失敗した場合の保険）
  const ensured = ensureD7HasFSharp(normalized, song, style, params, rng);

  return {
    id: `${style}-${level}-${seed}-${candidateIndex}`,
    style,
    level,
    params,
    seed,
    events: ensured,
  };
}

function isStrongStep(stepEighth: number): boolean {
  const inBar = stepEighth % EIGHTH_NOTES_PER_BAR;
  return inBar === 0 || inBar === 4;
}

function eventPrimaryMidi(e: PhraseEvent): number {
  return e.kind === "note" ? e.midi : Math.max(...e.midis);
}

function normalizeEvents(events: PhraseEvent[], song: Song, style: Style, maxFret: number): PhraseEvent[] {
  const profile = styleProfile(style);

  // step -> events
  const groups = new Map<number, PhraseEvent[]>();
  for (const e of events) {
    const playable =
      e.kind === "note"
        ? isPlayableMidi(e.midi, maxFret)
        : !e.midis.some((m) => !isPlayableMidi(m, maxFret));
    if (!playable) continue;

    const arr = groups.get(e.stepEighth) ?? [];
    arr.push(e);
    groups.set(e.stepEighth, arr);
  }

  const steps = [...groups.keys()].sort((a, b) => a - b);
  const out: PhraseEvent[] = [];

  for (const step of steps) {
    const cand = groups.get(step)!;
    if (cand.length === 1) {
      out.push(cand[0]!);
      continue;
    }

    const chord = chordAtStep(song.progression, step);
    const chordPcs = chordTonePcs(chord);
    const guidePcs = guideTonePcs(chord);
    const strong = isStrongStep(step);

    const notes = cand.filter((e) => e.kind === "note");
    const hits = cand.filter((e) => e.kind === "chordHit");

    const pickBestNote = (): PhraseEvent => {
      const scored = notes
        .map((e) => {
          const pc = mod12(eventPrimaryMidi(e));
          const guide = guidePcs.includes(pc) ? 2 : 0;
          const chordTone = chordPcs.includes(pc) ? 1 : 0;
          return { e, score: guide * 10 + chordTone * 3 };
        })
        .sort((a, b) => b.score - a.score);
      return scored[0]!.e;
    };

    if (strong) {
      // 強拍は単音の“着地”を最優先
      if (notes.length) out.push(pickBestNote());
      else out.push(hits[0]!);
      continue;
    }

    // 弱拍は、styleに応じて和音ヒットを優先（ある場合）
    if (profile.chordHits && hits.length) {
      out.push(hits[0]!);
      continue;
    }
    if (notes.length) out.push(pickBestNote());
    else out.push(hits[0]!);
  }

  return out;
}

function ensureD7HasFSharp(
  events: PhraseEvent[],
  song: Song,
  style: Style,
  params: GeneratorParams,
  rng: Rng,
): PhraseEvent[] {
  const d7Steps: number[] = [];
  const total = progressionTotalEighthNotes(song.progression);
  for (let step = 0; step < total; step += 1) {
    if (chordAtStep(song.progression, step).text === "D7") d7Steps.push(step);
  }
  if (d7Steps.length === 0) return events;

  const hasFSharp = events.some((e) => {
    if (e.kind === "note") return mod12(e.midi) === 6;
    return e.midis.some((m) => mod12(m) === 6);
  });
  if (hasFSharp) return events;

  // D7区間のどこかにF#を差し込む
  const insertAt = d7Steps[rng.int(0, d7Steps.length)];
  const midi = chooseMidiNearLastPosition({
    rng,
    pc: 6,
    maxFret: params.maxFret,
    positionPreference: params.positionPreference,
    lastMidi: null,
    lastPos: null,
    strong: false,
  }).midi;
  const patched: PhraseEvent[] = [...events, { kind: "note", stepEighth: insertAt, durationEighth: 1, midi }];
  return normalizeEvents(patched, song, style, params.maxFret);
}

