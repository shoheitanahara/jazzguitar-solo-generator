import type { Bar, Chord, Progression } from "./types";

export const EIGHTH_NOTES_PER_BEAT = 2;
export const BEATS_PER_BAR = 4;
export const EIGHTH_NOTES_PER_BAR = BEATS_PER_BAR * EIGHTH_NOTES_PER_BEAT; // 8

export function progressionTotalEighthNotes(prog: Progression): number {
  return prog.bars.length * EIGHTH_NOTES_PER_BAR;
}

export function barIndexFromStep(stepEighth: number): number {
  return Math.floor(stepEighth / EIGHTH_NOTES_PER_BAR);
}

export function stepInBar(stepEighth: number): number {
  const bar = barIndexFromStep(stepEighth);
  return stepEighth - bar * EIGHTH_NOTES_PER_BAR;
}

export function chordAtStep(prog: Progression, stepEighth: number): Chord {
  const barIndex = barIndexFromStep(stepEighth);
  const bar = prog.bars[barIndex];
  if (!bar) throw new Error(`step out of range: ${stepEighth}`);

  const posBeats = stepInBar(stepEighth) / EIGHTH_NOTES_PER_BEAT; // 0..3.5
  let acc = 0;
  for (const seg of bar.segments) {
    if (posBeats >= acc && posBeats < acc + seg.beats) return seg.chord;
    acc += seg.beats;
  }
  // 端数は最後のセグメント扱い（安全側）
  return bar.segments[bar.segments.length - 1]!.chord;
}

export function formatChordChartBars(bars: readonly Bar[]): string[] {
  // 4小節で改行するため、行ごとに文字列配列を返す
  const lines: string[] = [];
  for (let i = 0; i < bars.length; i += 4) {
    const slice = bars.slice(i, i + 4);
    const line = slice
      .map((bar) => bar.segments.map((s) => s.chord.text).join(" "))
      .map((s) => s.padEnd(12, " "))
      .join("| ");
    lines.push(`| ${line}|`);
  }
  return lines;
}

type Section = {
  label: string;
  startBarIndex: number; // 0-based
  endBarIndexExclusive: number; // 0-based
};

export function formatChordChartWithSections(args: {
  bars: readonly Bar[];
  sections: readonly Section[];
  barsPerLine?: number;
  barCellWidth?: number;
}): string[] {
  const { bars, sections, barsPerLine = 4, barCellWidth = 16 } = args;
  const lines: string[] = [];

  const barText = (bar: Bar) => bar.segments.map((s) => s.chord.text).join(" ");
  const padCell = (s: string) => s.padEnd(barCellWidth, " ");

  for (const sec of sections) {
    const startBarNo = sec.startBarIndex + 1;
    const endBarNo = sec.endBarIndexExclusive;
    lines.push(`${sec.label} (bars ${startBarNo}–${endBarNo})`);

    for (let i = sec.startBarIndex; i < sec.endBarIndexExclusive; i += barsPerLine) {
      const slice = bars.slice(i, Math.min(i + barsPerLine, sec.endBarIndexExclusive));

      const nums = slice
        .map((_, idx) => String(i + idx + 1))
        .map((n) => padCell(n))
        .join("| ");
      const chords = slice
        .map((b) => barText(b))
        .map((s) => padCell(s))
        .join("| ");

      lines.push(`| ${nums}|`);
      lines.push(`| ${chords}|`);
    }

    lines.push(""); // blank line between sections
  }

  // trim trailing blank lines
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

