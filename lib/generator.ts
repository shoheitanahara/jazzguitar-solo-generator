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

function rhythmicSlotsForBar(rng: Rng, density: number, level: Level): number[] {
  // 8分単位（1小節=8）
  const d = clamp01(density);
  const lf = levelFactor(level);

  // 低密度: 1拍目/3拍目中心
  if (d < 0.25) return [0, 4];
  // 中: 1拍目/2拍目&/3拍目/4拍目&（やや跳ね）
  if (d < 0.55) return rng.bool(0.5) ? [0, 2, 4, 6] : [0, 3, 4, 7];
  // 高: 8分連打寄り、ただし単調回避のため少し抜く
  const base = [0, 1, 2, 3, 4, 5, 6, 7];
  if (lf < 0.5) {
    // 抜きは少なめ
    base.splice(rng.int(1, 7), 1);
  } else {
    // 抜きを増やしてシンコペ気味
    base.splice(rng.int(1, 7), 1);
    base.splice(rng.int(1, 7), 1);
  }
  return base;
}

// 強拍ルールは生成の内部ロジックに直接埋め込み、現段階では別データとして保持しない。

function chooseMidiNearPosition(
  rng: Rng,
  pc: PitchClass,
  maxFret: number,
  positionPreference: number,
  lastMidi: number | null,
): number {
  // まずは弾けるMIDI候補を列挙（E3..E5あたりが扱いやすい）
  const minMidi = 52; // E3
  const maxMidi = 76; // E5
  const candidates = midiCandidatesForPitchClass(pc, minMidi, maxMidi).filter((m) =>
    isPlayableMidi(m, maxFret),
  );
  if (candidates.length === 0) {
    // フォールバック: 範囲を広げる
    const wider = midiCandidatesForPitchClass(pc, 40, 88).filter((m) => isPlayableMidi(m, maxFret));
    return wider.length ? wider[rng.int(0, wider.length)] : 64;
  }

  // “弦上のフレット” が positionPreference に近いものを優先
  const scored = candidates
    .map((m) => {
      const pos = positionsForMidi(m, maxFret);
      const bestFret = Math.min(...pos.map((p) => p.fret));
      const fretDist = Math.abs(bestFret - positionPreference);
      const leap = lastMidi == null ? 0 : Math.abs(m - lastMidi);
      // 跳躍も多少抑制（生成段階の粗い制約）
      const score = fretDist * 1.0 + leap * 0.35;
      return { m, score };
    })
    .sort((a, b) => a.score - b.score);

  // 上位からランダムに選び、硬直しすぎないようにする
  const take = Math.min(6, scored.length);
  return scored[rng.int(0, take)]!.m;
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

function approachOrEnclosure(
  rng: Rng,
  targetPc: PitchClass,
  chromaticRate: number,
  useEnclosure: boolean,
): PitchClass[] {
  const c = clamp01(chromaticRate);
  if (!rng.bool(c)) return [targetPc];

  // approach: 半音上下
  if (!useEnclosure || rng.bool(0.6)) {
    const fromAbove = rng.bool(0.5);
    const a = mod12(targetPc + (fromAbove ? 1 : -1));
    return [a, targetPc];
  }

  // enclosure: 上→下→着地（±1中心、時々±2）
  const up = mod12(targetPc + (rng.bool(0.7) ? 1 : 2));
  const down = mod12(targetPc - (rng.bool(0.7) ? 1 : 2));
  return [up, down, targetPc];
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
  chordPcs: readonly PitchClass[],
  maxFret: number,
  positionPreference: number,
): number[] | null {
  // 2〜4音。まずは triad + 7th を優先しつつ「押さえられる形」しか採用しない。
  const desiredCount = rng.pick([2, 3, 3, 4] as const);
  const pcsPool = [...chordPcs];

  const picked: PitchClass[] = [];
  while (picked.length < desiredCount && pcsPool.length) {
    picked.push(pcsPool.splice(rng.int(0, pcsPool.length), 1)[0]!);
  }
  if (picked.length < 2) return null;

  // 各PCのmidi候補（ポジション寄り）を少数列挙
  const perPcMidi: number[][] = picked.map((pc) => {
    const minMidi = 45; // A2
    const maxMidi = 76; // E5
    const candidates = midiCandidatesForPitchClass(pc, minMidi, maxMidi)
      .filter((m) => isPlayableMidi(m, maxFret))
      .map((m) => {
        const pos = positionsForMidi(m, maxFret);
        const bestFret = Math.min(...pos.map((p) => p.fret));
        const fretDist = Math.abs(bestFret - positionPreference);
        return { m, fretDist };
      })
      .sort((a, b) => a.fretDist - b.fretDist)
      .slice(0, 4)
      .map((x) => x.m);

    // フォールバック
    return candidates.length ? candidates : [chooseMidiNearPosition(rng, pc, maxFret, positionPreference, null)];
  });

  // 「押さえられる」判定: 隣接弦・フレット幅小・弦幅小の組み合わせが存在するか
  type Shape = { midis: number[]; cost: number };
  const shapes: Shape[] = [];

  const dfs = (idx: number, acc: number[]) => {
    if (idx >= perPcMidi.length) {
      const uniq = new Set(acc);
      if (uniq.size !== acc.length) return;
      const shape = bestPlayableChordShape(acc, maxFret, positionPreference);
      if (shape) shapes.push(shape);
      return;
    }
    for (const m of perPcMidi[idx]!) dfs(idx + 1, [...acc, m]);
  };
  dfs(0, []);

  if (shapes.length === 0) return null;
  shapes.sort((a, b) => a.cost - b.cost);
  const best = shapes[Math.min(rng.int(0, Math.min(3, shapes.length)), shapes.length - 1)]!;
  return best.midis.sort((a, b) => a - b);
}

function bestPlayableChordShape(
  midis: readonly number[],
  maxFret: number,
  posPref: number,
): { midis: number[]; cost: number } | null {
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
      const cost = fretSpan * 1.4 + stringSpan * 0.9 + Math.abs(avgF - posPref) * 0.25;
      return { midis: c.midis, cost };
    })
    .filter((x): x is { midis: number[]; cost: number } => x != null)
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
  const occupied = new Set<number>();

  // モチーフ（候補ごとに固定して反復しやすくする）
  const motif =
    profile.motif && rng.bool(clamp01(params.motifRate)) ? buildMotif(rng, level) : null;

  for (let bar = 0; bar < song.progression.bars.length; bar += 1) {
    const barStart = bar * EIGHTH_NOTES_PER_BAR;
    const barObj = song.progression.bars[bar]!;

    // まず “典型フォーム” を2拍単位で埋める（滑らかなラインを優先）
    const baseFormRate =
      profile.guideToneStrict ? 0.65 : profile.motif ? 0.25 : profile.chordHits ? 0.45 : 0.5;
    const levelBoost = (level - 1) * 0.08;
    const densityBoost = Math.max(0, params.density - 0.35) * 0.6;
    const formRate = Math.max(0, Math.min(0.95, baseFormRate + levelBoost + densityBoost));

    for (const seg of barObj.segments) {
      // 2拍単位で分割（4拍セグメントは2回）
      for (let beat = 0; beat < seg.beats; beat += 2) {
        const startStep = barStart + beat * 2;
        const nextStep = startStep + 4;
        if (nextStep > total) continue;
        if (!rng.bool(formRate)) continue;

        const startGuide = guideTargets.get(startStep) ?? rng.pick(guideTonePcs(seg.chord));
        const nextChord = chordAtStep(song.progression, Math.min(nextStep, total - 1));
        const nextGuide = guideTargets.get(nextStep) ?? rng.pick(guideTonePcs(nextChord));

        const chordPcs = chordTonePcs(seg.chord);
        const scalePcs = seg.chord.scalePcs;
        const space =
          profile.guideToneStrict
            ? Math.max(0.15, 0.65 - params.density)
            : Math.max(0.05, 0.55 - params.density);
        const form = generateTwoBeatForm({
          rng,
          startGuidePc: startGuide,
          nextGuidePc: nextGuide,
          chordPcs,
          scalePcs,
          chromaticRate: params.chromaticRate,
          space,
          lastMidi,
        });

        for (let i = 0; i < form.pcs.length; i += 1) {
          const step = startStep + i;
          if (step >= total) continue;
          const pc = form.pcs[i];
          if (pc == null) continue;
          const midi = chooseMidiNearPosition(rng, pc, params.maxFret, params.positionPreference, lastMidi);
          events.push({ kind: "note", stepEighth: step, durationEighth: 1, midi });
          occupied.add(step);
          lastMidi = midi;
        }
      }
    }

    // Joe Pass/Jim Hall系: バックビート（2・4）に軽いコンピングを混ぜると“弾き語り感”が出やすい
    if (profile.chordHits) {
      for (const localStep of [2, 6] as const) {
        const step = barStart + localStep;
        if (step >= total) continue;
        if (occupied.has(step)) continue;
        if (!rng.bool(clamp01(params.chordHitRate * 0.85))) continue;
        const chord = chordAtStep(song.progression, step);
        const hit = chordHitMidis(rng, chordTonePcs(chord), params.maxFret, params.positionPreference);
        if (!hit) continue;
        events.push({ kind: "chordHit", stepEighth: step, durationEighth: 1, midis: hit });
        occupied.add(step);
      }
    }

    // 次に、残りを従来ロジックで補完（密度やstyleの揺らぎを担保）
    const slots = rhythmicSlotsForBar(rng, params.density, level);
    for (const localStep of slots) {
      const step = barStart + localStep;
      if (step >= total) continue;
      if (occupied.has(step)) continue;

      const chord = chordAtStep(song.progression, step);
      const chordPcs = chordTonePcs(chord);
      const guides = guideTonePcs(chord);

      const isStrong = localStep === 0 || localStep === 4;
      const isD7 = chord.text === "D7";

      // JoePassType: 和音ヒットを時々差し込む（ただし強拍は単音優先で安定させる）
      if (profile.chordHits && !isStrong && rng.bool(clamp01(params.chordHitRate))) {
        const hit = chordHitMidis(rng, chordPcs, params.maxFret, params.positionPreference);
        if (hit) {
          events.push({
            kind: "chordHit",
            stepEighth: step,
            durationEighth: 1,
            midis: hit,
          });
          continue;
        }
      }

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
      if (motif && rng.bool(clamp01(params.motifRate)) && (isStrong || rng.bool(0.4))) {
        const pcs = applyMotifFromStartPc(targetPc, motif);
        let local = step;
        for (const pc of pcs) {
          if (local >= barStart + EIGHTH_NOTES_PER_BAR) break;
          const midi = chooseMidiNearPosition(
            rng,
            pc,
            params.maxFret,
            params.positionPreference,
            lastMidi,
          );
          events.push({ kind: "note", stepEighth: local, durationEighth: 1, midi });
          lastMidi = midi;
          local += 1;
        }
        continue;
      }

      // approach/enclosure: strong beat 直前を優先的に装飾（後で採点に効く）
      const useEnclosure = profile.motif || style === "ModernBebopType" || level >= 3;
      const decoration = approachOrEnclosure(rng, targetPc, params.chromaticRate, useEnclosure);

      for (let i = 0; i < decoration.length; i += 1) {
        const decoratedPc = decoration[i]!;
        const offset = decoration.length >= 2 ? -(decoration.length - 1 - i) : 0;
        const decoratedStep = step + offset;
        if (decoratedStep < barStart) continue;

        const midi = chooseMidiNearPosition(
          rng,
          decoratedPc,
          params.maxFret,
          params.positionPreference,
          lastMidi,
        );

        events.push({ kind: "note", stepEighth: decoratedStep, durationEighth: 1, midi });
        lastMidi = midi;
      }
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
  const midi = chooseMidiNearPosition(rng, 6, params.maxFret, params.positionPreference, null);
  const patched: PhraseEvent[] = [...events, { kind: "note", stepEighth: insertAt, durationEighth: 1, midi }];
  return normalizeEvents(patched, song, style, params.maxFret);
}

