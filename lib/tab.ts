import type { Song } from "./music/types";
import { EIGHTH_NOTES_PER_BAR, progressionTotalEighthNotes } from "./music/progression";
import type { PhraseCandidate, PhraseEvent } from "./generator";
import type { GuitarPosition, StringIndex } from "./guitar";
import { positionsForMidi } from "./guitar";

export type TabRenderResult = {
  tab: string;
  /** 選択された運指（デバッグ/将来拡張用） */
  fingering: ReadonlyArray<{
    stepEighth: number;
    positions: readonly GuitarPosition[];
  }>;
};

type FingeringOption = {
  positions: readonly GuitarPosition[]; // chordHitは複数
  avgFret: number;
  avgString: number;
  fretSpan: number;
  minString: number;
  maxString: number;
  stringSpan: number;
  stringCount: number;
};

function cellForFret(fret: number): string {
  const s = String(fret);
  if (s.length === 1) return `-${s}--`;
  if (s.length === 2) return `-${s}-`;
  return s.slice(0, 3).padEnd(4, "-");
}

function emptyCell(): string {
  return "----";
}

function avg(nums: readonly number[]): number {
  return nums.reduce((a, b) => a + b, 0) / Math.max(1, nums.length);
}

function toOption(positions: readonly GuitarPosition[]): FingeringOption {
  const frets = positions.map((p) => p.fret);
  const strings = positions.map((p) => p.string);
  const minString = strings.length ? Math.min(...strings) : 0;
  const maxString = strings.length ? Math.max(...strings) : 0;
  return {
    positions,
    avgFret: avg(frets),
    avgString: avg(strings),
    fretSpan: Math.max(...frets) - Math.min(...frets),
    minString,
    maxString,
    stringSpan: maxString - minString,
    stringCount: strings.length,
  };
}

function isContiguousStrings(positions: readonly GuitarPosition[]): boolean {
  if (positions.length <= 1) return true;
  const strings = [...new Set(positions.map((p) => p.string))].sort((a, b) => a - b);
  for (let i = 1; i < strings.length; i += 1) {
    if (strings[i]! - strings[i - 1]! !== 1) return false;
  }
  return true;
}

function bestNoteOptions(midi: number, maxFret: number, posPref: number): FingeringOption[] {
  const pos = positionsForMidi(midi, maxFret)
    .slice()
    .sort((a, b) => {
      const fretA = Math.abs(a.fret - posPref);
      const fretB = Math.abs(b.fret - posPref);
      if (fretA !== fretB) return fretA - fretB;
      // “ジャズっぽい”単音は極端な低音弦/高音弦に寄せすぎない（軽いバイアス）
      const midBiasA = Math.abs(a.string - 3);
      const midBiasB = Math.abs(b.string - 3);
      return midBiasA - midBiasB;
    });
  // 上位だけ（爆発を防ぐ）
  return pos.slice(0, 8).map((p) => toOption([p]));
}

function uniqueStrings(positions: readonly GuitarPosition[]): boolean {
  const s = new Set<number>();
  for (const p of positions) {
    if (s.has(p.string)) return false;
    s.add(p.string);
  }
  return true;
}

function chordHitOptions(midis: readonly number[], maxFret: number, posPref: number): FingeringOption[] {
  // 各音の候補を絞ってから組み合わせ（2〜4音なので現実的）
  const perNote = midis.map((m) =>
    positionsForMidi(m, maxFret)
      .slice()
      .sort((a, b) => Math.abs(a.fret - posPref) - Math.abs(b.fret - posPref))
      .slice(0, 3),
  );
  if (perNote.some((x) => x.length === 0)) return [];

  const combos: GuitarPosition[][] = [];

  const dfs = (idx: number, acc: GuitarPosition[]) => {
    if (idx >= perNote.length) {
      combos.push(acc);
      return;
    }
    for (const p of perNote[idx]!) {
      if (acc.some((a) => a.string === p.string)) continue;
      dfs(idx + 1, [...acc, p]);
    }
  };
  dfs(0, []);

  const options = combos
    .filter((pos) => uniqueStrings(pos))
    // 和音は「隣接弦」中心の方が押さえやすい（ジャズギターのコンピングっぽい）
    .filter((pos) => isContiguousStrings(pos))
    .map((pos) => toOption(pos))
    // “和音”として成立しやすい範囲に寄せる（過度なストレッチ回避）
    .filter((o) => o.fretSpan <= 4)
    .filter((o) => o.stringSpan <= 3)
    .sort((a, b) => {
      // 押さえやすさ優先: フレット幅→弦幅→中心ポジション
      const aCost = a.fretSpan * 1.2 + a.stringSpan * 0.9 + Math.abs(a.avgFret - posPref) * 0.2;
      const bCost = b.fretSpan * 1.2 + b.stringSpan * 0.9 + Math.abs(b.avgFret - posPref) * 0.2;
      return aCost - bCost;
    });

  return options.slice(0, 12);
}

function eventOptions(event: PhraseEvent, maxFret: number, posPref: number): FingeringOption[] {
  if (event.kind === "note") return bestNoteOptions(event.midi, maxFret, posPref);
  return chordHitOptions(event.midis, maxFret, posPref);
}

type DpCell = {
  cost: number;
  prevIndex: number;
};

function transitionCost(a: FingeringOption, b: FingeringOption, posPref: number): number {
  const moveFret = Math.abs(a.avgFret - b.avgFret);
  const moveString = Math.abs(a.avgString - b.avgString);
  const spanPenalty = b.fretSpan * 0.55;
  const stringSpanPenalty = b.stringSpan * 0.45;
  const posPenalty = Math.abs(b.avgFret - posPref) * 0.12;

  // 高音弦↔低音弦の“行き来”を抑える（音色が急に変わってジャズギターらしさが落ちる）
  const regionA = a.avgString <= 2 ? "low" : a.avgString >= 4 ? "high" : "mid";
  const regionB = b.avgString <= 2 ? "low" : b.avgString >= 4 ? "high" : "mid";
  const regionSwitchPenalty = regionA !== regionB ? 1.8 : 0;

  // 単音ラインでの極端弦を軽く避ける（和音は除外しない）
  const extremeStringPenalty =
    b.stringCount === 1 && (b.minString === 0 || b.maxString === 5) ? 0.25 : 0;

  return (
    moveFret * 1.0 +
    moveString * 2.0 +
    spanPenalty +
    stringSpanPenalty +
    posPenalty +
    regionSwitchPenalty +
    extremeStringPenalty
  );
}

function pickFingering(events: readonly PhraseEvent[], maxFret: number, posPref: number): FingeringOption[] {
  const sorted = events.slice().sort((a, b) => a.stepEighth - b.stepEighth);
  const options = sorted.map((e) => eventOptions(e, maxFret, posPref));

  if (options.some((o) => o.length === 0)) {
    // 何らかの理由で候補が作れない場合のフォールバック（空運指扱い）
    return sorted.map((e) =>
      toOption(
        e.kind === "note" ? positionsForMidi(e.midi, maxFret).slice(0, 1) : [],
      ),
    );
  }

  const dp: DpCell[][] = options.map((opts) => opts.map(() => ({ cost: Infinity, prevIndex: -1 })));

  // 初期
  for (let j = 0; j < options[0]!.length; j += 1) {
    const o = options[0]![j]!;
    dp[0]![j] = { cost: Math.abs(o.avgFret - posPref) * 0.3 + o.fretSpan * 0.2, prevIndex: -1 };
  }

  for (let i = 1; i < options.length; i += 1) {
    for (let j = 0; j < options[i]!.length; j += 1) {
      const cur = options[i]![j]!;
      let bestCost = Infinity;
      let bestPrev = -1;
      for (let k = 0; k < options[i - 1]!.length; k += 1) {
        const prev = options[i - 1]![k]!;
        const cost = dp[i - 1]![k]!.cost + transitionCost(prev, cur, posPref);
        if (cost < bestCost) {
          bestCost = cost;
          bestPrev = k;
        }
      }
      dp[i]![j] = { cost: bestCost, prevIndex: bestPrev };
    }
  }

  // 終端
  let lastJ = 0;
  let best = Infinity;
  const lastRow = dp[dp.length - 1]!;
  for (let j = 0; j < lastRow.length; j += 1) {
    if (lastRow[j]!.cost < best) {
      best = lastRow[j]!.cost;
      lastJ = j;
    }
  }

  // 復元
  const chosen: FingeringOption[] = [];
  let j = lastJ;
  for (let i = dp.length - 1; i >= 0; i -= 1) {
    chosen[i] = options[i]![j]!;
    const prev = dp[i]![j]!.prevIndex;
    j = prev === -1 ? 0 : prev;
  }
  return chosen;
}

function stringLabelForIndex(string: StringIndex): string {
  // 0=6弦(E) ... 5=1弦(e)
  return ["E", "A", "D", "G", "B", "e"][string]!;
}

function lineOrderHighToLow(): StringIndex[] {
  return [5, 4, 3, 2, 1, 0];
}

function placeText(buffer: string[], start: number, text: string) {
  for (let i = 0; i < text.length; i += 1) {
    const idx = start + i;
    if (idx < 0 || idx >= buffer.length) return;
    buffer[idx] = text[i]!;
  }
}

function chordTimingLineForBlock(args: {
  song: Song;
  startStep: number;
  steps: number;
}): string {
  const { song, startStep, steps } = args;
  const startBar = Math.floor(startStep / EIGHTH_NOTES_PER_BAR);
  const barsCount = Math.ceil(steps / EIGHTH_NOTES_PER_BAR);

  // 1セル=4文字（TABと同じ）
  const cellWidth = 4;
  const barCharLen = EIGHTH_NOTES_PER_BAR * cellWidth; // 32

  const barStrings: string[] = [];
  for (let i = 0; i < barsCount; i += 1) {
    const bar = song.progression.bars[startBar + i];
    if (!bar) break;

    const buf = Array.from({ length: barCharLen }, () => " ");
    let beatAcc = 0;
    for (const seg of bar.segments) {
      const stepInBar = beatAcc * 2; // 1 beat = 2 eighth notes
      const charIndex = stepInBar * cellWidth;
      placeText(buf, charIndex, seg.chord.text);
      beatAcc += seg.beats;
    }
    barStrings.push(buf.join("").replace(/\s+$/g, ""));
  }

  const body = barStrings.map((s) => s.padEnd(barCharLen, " ")).join("|");
  // 1行目はラベルのみ（ズレ要因にしない）。2行目をTABの "e|" と同じ列から開始する。
  return `Chords\n |${body}|`;
}

function renderBlock(args: {
  song: Song;
  placement: Map<number, GuitarPosition[]>;
  startStep: number;
  steps: number;
}): string {
  const { song, placement, startStep, steps } = args;

  const lines: Record<StringIndex, string[]> = {
    0: [],
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
  };

  for (let i = 0; i < steps; i += 1) {
    const step = startStep + i;
    const pos = placement.get(step) ?? [];
    const byString = new Map<StringIndex, number>(); // string -> fret
    for (const p of pos) {
      const cur = byString.get(p.string);
      if (cur == null || p.fret > cur) byString.set(p.string, p.fret);
    }

    for (let s = 0 as StringIndex; s <= 5; s = (s + 1) as StringIndex) {
      const fret = byString.get(s);
      lines[s].push(fret == null ? emptyCell() : cellForFret(fret));
    }
  }

  const order = lineOrderHighToLow();
  const renderedLines = order.map((s) => {
    const label = stringLabelForIndex(s);
    let body = "";
    for (let i = 0; i < lines[s].length; i += 1) {
      body += lines[s][i]!;
      if ((i + 1) % 8 === 0) body += "|";
    }
    return `${label}|${body}`;
  });

  const chordLine = chordTimingLineForBlock({ song, startStep, steps });

  return `${chordLine}\n${renderedLines.join("\n")}`;
}

export function renderTab(song: Song, phrase: PhraseCandidate): TabRenderResult {
  const totalSteps = progressionTotalEighthNotes(song.progression);
  const events = phrase.events.slice().sort((a, b) => a.stepEighth - b.stepEighth);
  const options = pickFingering(events, phrase.params.maxFret, phrase.params.positionPreference);

  // step -> positions
  const placement = new Map<number, GuitarPosition[]>();
  for (let i = 0; i < events.length; i += 1) {
    placement.set(events[i]!.stepEighth, [...options[i]!.positions]);
  }

  const header = `Tempo: 8th-note grid (4/4: 1 bar = 8 cells). Strings: eBGDAE`;
  const blocks: string[] = [];

  // 横にはみ出しやすいので、4小節（32step）ごとに折り返す
  const stepsPerBlock = 32;
  for (let start = 0; start < totalSteps; start += stepsPerBlock) {
    const steps = Math.min(stepsPerBlock, totalSteps - start);
    blocks.push(
      renderBlock({
        song,
        placement,
        startStep: start,
        steps,
      }),
    );
  }

  const tab = `${header}\n\n${blocks.join("\n\n")}`;

  return {
    tab,
    fingering: events.map((e, i) => ({ stepEighth: e.stepEighth, positions: options[i]!.positions })),
  };
}

