import type { Song } from "./music/types";
import { chordAtStep, EIGHTH_NOTES_PER_BAR, progressionTotalEighthNotes } from "./music/progression";
import { chordTonePcs, guideTonePcs } from "./music/chords";
import { mod12 } from "./music/notes";
import type { PhraseCandidate, PhraseEvent } from "./generator";
import { positionsForMidi } from "./guitar";

export type ScoreBreakdown = {
  strongBeatChordToneScore: number;
  guideToneScore: number;
  voiceLeadingScore: number;
  tensionResolutionScore: number;
  rangePenalty: number;
  leapPenalty: number;
  guitarIdiomaticScore: number;
  rhythmVarietyScore: number;
  d7ResolutionRuleScore: number;
  total: number;
};

export type ScoredCandidate = {
  candidate: PhraseCandidate;
  breakdown: ScoreBreakdown;
};

function clamp(min: number, x: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}

function isStrongStep(stepEighth: number): boolean {
  const inBar = stepEighth % EIGHTH_NOTES_PER_BAR;
  return inBar === 0 || inBar === 4;
}

function eventPrimaryMidi(event: PhraseEvent): number {
  if (event.kind === "note") return event.midi;
  // chordHitは最高音を代表に（フレーズの輪郭評価に使いやすい）
  return Math.max(...event.midis);
}

function eventAnchorMidi(event: PhraseEvent): number {
  if (event.kind === "note") return event.midi;
  // chordHitは左手の“基準”として最低音（bass）を代表にする
  return Math.min(...event.midis);
}

function collectStepMap(events: readonly PhraseEvent[]): Map<number, PhraseEvent> {
  const map = new Map<number, PhraseEvent>();
  for (const e of events) map.set(e.stepEighth, e);
  return map;
}

function nearestEventAtOrBefore(map: Map<number, PhraseEvent>, step: number): PhraseEvent | null {
  for (let s = step; s >= 0; s -= 1) {
    const e = map.get(s);
    if (e) return e;
  }
  return null;
}

function nearestEventAtOrAfter(
  map: Map<number, PhraseEvent>,
  step: number,
  maxStep: number,
): PhraseEvent | null {
  for (let s = step; s <= maxStep; s += 1) {
    const e = map.get(s);
    if (e) return e;
  }
  return null;
}

export function scoreCandidate(song: Song, candidate: PhraseCandidate): ScoreBreakdown {
  const totalSteps = progressionTotalEighthNotes(song.progression);
  const stepMap = collectStepMap(candidate.events);

  let strongBeatChordToneScore = 0;
  let guideToneScore = 0;
  let voiceLeadingScore = 0;
  let tensionResolutionScore = 0;
  let rangePenalty = 0;
  let leapPenalty = 0;
  let guitarIdiomaticScore = 0;
  let rhythmVarietyScore = 0;
  let d7ResolutionRuleScore = 0;

  // strong beat / guide tone
  for (let step = 0; step < totalSteps; step += 1) {
    if (!isStrongStep(step)) continue;
    const e = stepMap.get(step);
    if (!e) {
      strongBeatChordToneScore -= 1.2;
      guideToneScore -= 0.6;
      continue;
    }
    const chord = chordAtStep(song.progression, step);
    const chordPcs = chordTonePcs(chord);
    const guidePcs = guideTonePcs(chord);

    const primary = eventPrimaryMidi(e);
    const pc = mod12(primary);
    if (chordPcs.includes(pc)) strongBeatChordToneScore += 2.0;
    else strongBeatChordToneScore -= 2.2;

    if (guidePcs.includes(pc)) guideToneScore += 1.8;
    else if (chordPcs.includes(pc)) guideToneScore += 0.3;
    else guideToneScore -= 0.8;
  }

  // voice leading: 各コード切り替わり直前の音が、次コードのガイドトーンへ近いほど加点
  // 今回は2拍ごとに切り替わるので、bar内 step=3,7 を「終端」扱い（8分刻み）
  for (let bar = 0; bar < song.progression.bars.length; bar += 1) {
    const barStart = bar * EIGHTH_NOTES_PER_BAR;
    const endings = [barStart + 3, barStart + 7];
    for (const endStep of endings) {
      const curChord = chordAtStep(song.progression, endStep);
      const nextStep = clamp(0, endStep + 1, totalSteps - 1);
      const nextChord = chordAtStep(song.progression, nextStep);
      if (curChord.text === nextChord.text) continue;

      const e = nearestEventAtOrBefore(stepMap, endStep);
      if (!e) continue;
      const midi = eventPrimaryMidi(e);
      const nextGuides = guideTonePcs(nextChord);

      // 次コードのガイドトーンに最も近いピッチクラス距離（0..6）
      const curPc = mod12(midi);
      const pcDist = Math.min(
        ...nextGuides.map((g) => {
          const d = Math.abs(curPc - g);
          return Math.min(d, 12 - d);
        }),
      );
      voiceLeadingScore += (6 - pcDist) * 0.25;
    }
  }

  // tension resolution: chord tone以外→次にchord toneへ解決 で加点
  for (let step = 0; step < totalSteps - 1; step += 1) {
    const e = stepMap.get(step);
    if (!e) continue;
    const chord = chordAtStep(song.progression, step);
    const chordPcs = chordTonePcs(chord);
    const pc = mod12(eventPrimaryMidi(e));
    const isTension = !chordPcs.includes(pc);
    if (!isTension) continue;

    const next = nearestEventAtOrAfter(stepMap, step + 1, totalSteps - 1);
    if (!next) {
      tensionResolutionScore -= 0.3;
      continue;
    }
    const nextChord = chordAtStep(song.progression, next.stepEighth);
    const nextChordTones = chordTonePcs(nextChord);
    const nextPc = mod12(eventPrimaryMidi(next));
    if (nextChordTones.includes(nextPc)) tensionResolutionScore += 0.35;
    else tensionResolutionScore -= 0.2;
  }

  // range + leaps
  const midis = candidate.events
    .flatMap((e) => (e.kind === "note" ? [e.midi] : [...e.midis]))
    .filter((m) => Number.isFinite(m));
  if (midis.length > 0) {
    const min = Math.min(...midis);
    const max = Math.max(...midis);
    const span = max - min;
    if (span > 18) rangePenalty -= (span - 18) * 0.15;
    if (span > 24) rangePenalty -= (span - 24) * 0.25;
  }

  const contour = candidate.events
    .filter((e) => e.kind === "note" || e.kind === "chordHit")
    .slice()
    .sort((a, b) => a.stepEighth - b.stepEighth)
    .map((e) => eventPrimaryMidi(e));
  for (let i = 1; i < contour.length; i += 1) {
    const leap = Math.abs(contour[i]! - contour[i - 1]!);
    if (leap >= 10) leapPenalty -= 0.8;
    if (leap >= 14) leapPenalty -= 1.2;
    if (leap >= 19) leapPenalty -= 1.8;
  }

  // guitar idiomatic: ポジション周辺で成立しやすいほど加点（あくまで簡易）
  const posPref = candidate.params.positionPreference;
  for (const e of candidate.events) {
    if (e.kind !== "note") continue;
    const pos = positionsForMidi(e.midi, candidate.params.maxFret);
    if (pos.length === 0) {
      guitarIdiomaticScore -= 2.0;
      continue;
    }
    const best = Math.min(...pos.map((p) => Math.abs(p.fret - posPref)));
    guitarIdiomaticScore += clamp(0, 1.2 - best * 0.25, 1.2);
  }

  // guitar idiomatic guardrail: 連続イベント間の“最小移動”が大きいほど減点（弦飛び越え/ポジション移動）
  const ordered = candidate.events.slice().sort((a, b) => a.stepEighth - b.stepEighth);
  for (let i = 1; i < ordered.length; i += 1) {
    const a = eventAnchorMidi(ordered[i - 1]!);
    const b = eventAnchorMidi(ordered[i]!);
    const pa = positionsForMidi(a, candidate.params.maxFret);
    const pb = positionsForMidi(b, candidate.params.maxFret);
    if (pa.length === 0 || pb.length === 0) continue;

    let bestMove = Number.POSITIVE_INFINITY;
    let bestStringDelta = 0;
    for (const x of pa) {
      for (const y of pb) {
        const sd = Math.abs(x.string - y.string);
        const fd = Math.abs(x.fret - y.fret);
        const move = sd * 2.2 + fd * 0.9;
        if (move < bestMove) {
          bestMove = move;
          bestStringDelta = sd;
        }
      }
    }

    // “遠すぎる移動”をしっかり減点（生成側が抑える前提なので、ここは保険）
    if (bestMove > 9) guitarIdiomaticScore -= (bestMove - 9) * 0.18;
    if (bestStringDelta >= 3) guitarIdiomaticScore -= 0.8;
  }

  // rhythm variety: 空白間隔が単調すぎると減点
  const steps = candidate.events.map((e) => e.stepEighth).sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < steps.length; i += 1) gaps.push(steps[i]! - steps[i - 1]!);
  if (gaps.length >= 4) {
    const uniq = new Set(gaps);
    if (uniq.size === 1) {
      // 8分連打（gap=1）の単調さは強く減点。
      // 4分中心（gap=2）などの“学習向けのシンプルさ”は減点しすぎない。
      const g = gaps[0]!;
      rhythmVarietyScore += g === 1 ? -2.0 : -0.2;
    }
    else if (uniq.size === 2) rhythmVarietyScore -= 0.6;
    else rhythmVarietyScore += 0.6;
  }

  // 8分の多さ guardrail: duration=1 が多い候補は優先度を落とす
  const eighthCount = candidate.events.filter((e) => e.kind === "note" && e.durationEighth === 1).length;
  if (eighthCount >= 10) rhythmVarietyScore -= (eighthCount - 9) * 0.25;

  // D7 rule: F# を含める + 次のGmへ「それっぽく」解決
  const hasFSharpOnD7 = candidate.events.some((e) => {
    if (e.kind === "note") {
      const chord = chordAtStep(song.progression, e.stepEighth);
      return chord.text === "D7" && mod12(e.midi) === 6;
    }
    const chord = chordAtStep(song.progression, e.stepEighth);
    return chord.text === "D7" && e.midis.some((m) => mod12(m) === 6);
  });
  d7ResolutionRuleScore += hasFSharpOnD7 ? 2.0 : -4.0;

  // D7直後（Gm頭）に Gmのガイドトーン( Bb or F )が来ると加点
  for (let step = 0; step < totalSteps; step += 1) {
    const chord = chordAtStep(song.progression, step);
    if (chord.text !== "Gm" && chord.text !== "Gm7") continue;
    const e = nearestEventAtOrAfter(stepMap, step, Math.min(step + 2, totalSteps - 1));
    if (!e) continue;
    const pc = mod12(eventPrimaryMidi(e));
    // Gmのガイドトーン: Bb(10) or F(5)
    if (pc === 10 || pc === 5) d7ResolutionRuleScore += 0.9;
  }

  const total =
    strongBeatChordToneScore +
    guideToneScore +
    voiceLeadingScore +
    tensionResolutionScore +
    rangePenalty +
    leapPenalty +
    guitarIdiomaticScore +
    rhythmVarietyScore +
    d7ResolutionRuleScore;

  return {
    strongBeatChordToneScore,
    guideToneScore,
    voiceLeadingScore,
    tensionResolutionScore,
    rangePenalty,
    leapPenalty,
    guitarIdiomaticScore,
    rhythmVarietyScore,
    d7ResolutionRuleScore,
    total,
  };
}

export function scoreCandidates(song: Song, candidates: readonly PhraseCandidate[]): ScoredCandidate[] {
  return candidates.map((c) => ({ candidate: c, breakdown: scoreCandidate(song, c) }));
}

