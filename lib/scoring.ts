import type { Song } from "./music/types";
import { chordAtStep, EIGHTH_NOTES_PER_BAR, progressionTotalEighthNotes } from "./music/progression";
import { chordTonePcs, guideTonePcs } from "./music/chords";
import { mod12 } from "./music/notes";
import type { PhraseCandidate, PhraseEvent } from "./generator";
import { positionsForMidi } from "./guitar";

export type ScoreBreakdown = {
  strongBeatChordToneScore: number;
  guideToneScore: number;
  chordToneUsageScore: number;
  voiceLeadingScore: number;
  tensionResolutionScore: number;
  melodicPenalty: number;
  rangePenalty: number;
  leapPenalty: number;
  guitarIdiomaticScore: number;
  chordHitVoicingPenalty: number;
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

function minFretSpanForChordHit(midis: readonly number[], maxFret: number): number | null {
  const per = midis.map((m) => positionsForMidi(m, maxFret));
  if (per.some((p) => p.length === 0)) return null;

  let bestSpan = Number.POSITIVE_INFINITY;
  const dfs = (idx: number, usedStrings: Set<number>, frets: number[]) => {
    if (idx >= per.length) {
      const span = Math.max(...frets) - Math.min(...frets);
      if (span < bestSpan) bestSpan = span;
      return;
    }
    for (const p of per[idx]!) {
      if (usedStrings.has(p.string)) continue;
      // prune
      if (frets.length) {
        const minF = Math.min(...frets, p.fret);
        const maxF = Math.max(...frets, p.fret);
        if (maxF - minF >= bestSpan) continue;
      }
      usedStrings.add(p.string);
      dfs(idx + 1, usedStrings, [...frets, p.fret]);
      usedStrings.delete(p.string);
    }
  };
  dfs(0, new Set<number>(), []);
  return Number.isFinite(bestSpan) ? bestSpan : null;
}

function estimatePositionsForEvents(args: {
  events: readonly PhraseEvent[];
  maxFret: number;
  positionPreference: number;
}): Array<{ stepEighth: number; string: number; fret: number; midi: number }> {
  const { events, maxFret, positionPreference } = args;
  const ordered = events.slice().sort((a, b) => a.stepEighth - b.stepEighth);
  const out: Array<{ stepEighth: number; string: number; fret: number; midi: number }> = [];

  let last: { string: number; fret: number } | null = null;
  for (const e of ordered) {
    const midi = eventAnchorMidi(e);
    const pos = positionsForMidi(midi, maxFret);
    if (pos.length === 0) continue;

    const scored = pos
      .map((p) => {
        const pref = Math.abs(p.fret - positionPreference) * 0.55;
        const move =
          last == null
            ? 0
            : Math.abs(p.string - last.string) * 2.2 + Math.abs(p.fret - last.fret) * 0.9;
        return { p, score: pref + move };
      })
      .sort((a, b) => a.score - b.score);

    const best = scored[0]!.p;
    out.push({ stepEighth: e.stepEighth, string: best.string, fret: best.fret, midi });
    last = { string: best.string, fret: best.fret };
  }

  return out;
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
  let chordToneUsageScore = 0;
  let voiceLeadingScore = 0;
  let tensionResolutionScore = 0;
  let melodicPenalty = 0;
  let rangePenalty = 0;
  let leapPenalty = 0;
  let guitarIdiomaticScore = 0;
  let chordHitVoicingPenalty = 0;
  let rhythmVarietyScore = 0;
  let d7ResolutionRuleScore = 0;

  // strong beat / guide tone
  let strongCount = 0;
  for (let step = 0; step < totalSteps; step += 1) {
    if (!isStrongStep(step)) continue;
    strongCount += 1;
    const e = stepMap.get(step);
    if (!e) {
      // 強拍が空白はかなり悪い（学習用途でも“骨格”が消える）
      strongBeatChordToneScore -= 1.4;
      guideToneScore -= 0.6;
      continue;
    }
    const chord = chordAtStep(song.progression, step);
    const chordPcs = chordTonePcs(chord);
    const guidePcs = guideTonePcs(chord);

    const primary = eventPrimaryMidi(e);
    const pc = mod12(primary);
    if (chordPcs.includes(pc)) strongBeatChordToneScore += 1.0;
    else strongBeatChordToneScore -= 1.2;

    if (guidePcs.includes(pc)) guideToneScore += 1.0;
    else if (chordPcs.includes(pc)) guideToneScore += 0.25;
    else guideToneScore -= 0.8;
  }

  // normalize: 32 bars => strong beats are many; keep this category bounded
  if (strongCount > 0) {
    strongBeatChordToneScore = (strongBeatChordToneScore / strongCount) * 10;
    guideToneScore = (guideToneScore / strongCount) * 8;
  }

  // chord tone usage (all notes, not just strong beats)
  for (const e of candidate.events) {
    const chord = chordAtStep(song.progression, e.stepEighth);
    const chordPcs = chordTonePcs(chord);
    const guidePcs = guideTonePcs(chord);
    const pc = mod12(eventPrimaryMidi(e));
    if (chordPcs.includes(pc)) chordToneUsageScore += 0.22;
    else chordToneUsageScore -= 0.12;
    if (guidePcs.includes(pc)) chordToneUsageScore += 0.08;
  }
  chordToneUsageScore = chordToneUsageScore / Math.max(1, candidate.events.length) * 8;

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
      voiceLeadingScore += (6 - pcDist) * 0.14;
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
    if (nextChordTones.includes(nextPc)) tensionResolutionScore += 0.25;
    else tensionResolutionScore -= 0.15;
  }

  // melodic penalty: same pitch repeated in the same bar (not melodic)
  for (let bar = 0; bar < song.progression.bars.length; bar += 1) {
    const barStart = bar * EIGHTH_NOTES_PER_BAR;
    const barEnd = barStart + EIGHTH_NOTES_PER_BAR;
    const inBar = candidate.events
      .filter((e) => e.stepEighth >= barStart && e.stepEighth < barEnd)
      .slice()
      .sort((a, b) => a.stepEighth - b.stepEighth);
    if (inBar.length < 2) continue;

    const midis = inBar.map((e) => eventPrimaryMidi(e));
    const uniq = new Set(midis);
    if (inBar.length >= 3 && uniq.size <= 1) melodicPenalty -= 1.6;

    // Many occurrences of the same note (even if not consecutive) is not melodic.
    const countByMidi = new Map<number, number>();
    for (const m of midis) countByMidi.set(m, (countByMidi.get(m) ?? 0) + 1);
    const maxCount = Math.max(...[...countByMidi.values()]);
    if (maxCount >= 3) melodicPenalty -= (maxCount - 2) * 0.65;

    let streak = 1;
    for (let i = 1; i < midis.length; i += 1) {
      if (midis[i] === midis[i - 1]) {
        streak += 1;
        melodicPenalty -= 0.9; // consecutive same note
        if (streak >= 3) melodicPenalty -= 0.5; // extra for long streaks
      } else {
        streak = 1;
      }
    }
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
  let posPrefSum = 0;
  let posPrefCount = 0;
  for (const e of candidate.events) {
    if (e.kind !== "note") continue;
    const pos = positionsForMidi(e.midi, candidate.params.maxFret);
    if (pos.length === 0) {
      guitarIdiomaticScore -= 2.0;
      continue;
    }
    const best = Math.min(...pos.map((p) => Math.abs(p.fret - posPref)));
    posPrefSum += clamp(0, 1.2 - best * 0.25, 1.2);
    posPrefCount += 1;
  }
  guitarIdiomaticScore += (posPrefSum / Math.max(1, posPrefCount)) * 6;

  // guitar idiomatic guardrail: “想定運指” を復元して、弦飛び越え/同弦隣接を評価
  const estimated = estimatePositionsForEvents({
    events: candidate.events,
    maxFret: candidate.params.maxFret,
    positionPreference: candidate.params.positionPreference,
  });
  for (let i = 1; i < estimated.length; i += 1) {
    const prev = estimated[i - 1]!;
    const cur = estimated[i]!;
    const sd = Math.abs(cur.string - prev.string);
    const fd = Math.abs(cur.fret - prev.fret);
    const move = sd * 2.2 + fd * 0.9;

    if (move > 9) guitarIdiomaticScore -= (move - 9) * 0.22;
    // 弦を1つ飛ばし（例: 3->1 / 4->2）
    if (sd === 2) guitarIdiomaticScore -= 1.8;
    if (sd >= 3) guitarIdiomaticScore -= 3.2;

    // 同弦の隣接フレットは加点（メロディックに聞こえやすい）
    if (sd === 0 && fd === 1) guitarIdiomaticScore += 0.65;
    if (sd === 0 && fd === 2) guitarIdiomaticScore += 0.3;
  }

  // chord hit voicing: hard to fret when spread too wide
  for (const e of candidate.events) {
    if (e.kind !== "chordHit") continue;
    const span = minFretSpanForChordHit(e.midis, candidate.params.maxFret);
    if (span == null) {
      chordHitVoicingPenalty -= 4.0;
      continue;
    }
    if (span >= 5) chordHitVoicingPenalty -= 8.0;
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
  d7ResolutionRuleScore += hasFSharpOnD7 ? 1.4 : -2.2;

  // D7直後（Gm頭）に Gmのガイドトーン( Bb or F )が来ると加点
  for (let step = 0; step < totalSteps; step += 1) {
    const chord = chordAtStep(song.progression, step);
    if (chord.text !== "Gm" && chord.text !== "Gm7") continue;
    const e = nearestEventAtOrAfter(stepMap, step, Math.min(step + 2, totalSteps - 1));
    if (!e) continue;
    const pc = mod12(eventPrimaryMidi(e));
    // Gmのガイドトーン: Bb(10) or F(5)
    if (pc === 10 || pc === 5) d7ResolutionRuleScore += 0.35;
  }

  const total =
    strongBeatChordToneScore +
    guideToneScore +
    chordToneUsageScore +
    voiceLeadingScore +
    tensionResolutionScore +
    melodicPenalty +
    rangePenalty +
    leapPenalty +
    guitarIdiomaticScore +
    chordHitVoicingPenalty +
    rhythmVarietyScore +
    d7ResolutionRuleScore;

  return {
    strongBeatChordToneScore,
    guideToneScore,
    chordToneUsageScore,
    voiceLeadingScore,
    tensionResolutionScore,
    melodicPenalty,
    rangePenalty,
    leapPenalty,
    guitarIdiomaticScore,
    chordHitVoicingPenalty,
    rhythmVarietyScore,
    d7ResolutionRuleScore,
    total,
  };
}

export function scoreCandidates(song: Song, candidates: readonly PhraseCandidate[]): ScoredCandidate[] {
  return candidates.map((c) => ({ candidate: c, breakdown: scoreCandidate(song, c) }));
}

