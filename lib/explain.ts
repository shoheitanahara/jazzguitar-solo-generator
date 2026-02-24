import type { Song } from "./music/types";
import { chordAtStep, EIGHTH_NOTES_PER_BAR, progressionTotalEighthNotes } from "./music/progression";
import { chordTonePcs, guideTonePcs } from "./music/chords";
import { mod12 } from "./music/notes";
import type { PitchClass } from "./music/types";
import type { PhraseCandidate } from "./generator";
import type { ScoreBreakdown } from "./scoring";

function isStrongStep(stepEighth: number): boolean {
  const inBar = stepEighth % EIGHTH_NOTES_PER_BAR;
  return inBar === 0 || inBar === 4;
}

function primaryPcOfEvent(e: PhraseCandidate["events"][number]): PitchClass {
  if (e.kind === "note") return mod12(e.midi);
  return mod12(Math.max(...e.midis));
}

export type Explanation = {
  summary: string;
  bullets: string[];
};

export function explainPhrase(args: {
  song: Song;
  phrase: PhraseCandidate;
  score: ScoreBreakdown;
}): Explanation {
  const { song, phrase, score } = args;
  const totalSteps = progressionTotalEighthNotes(song.progression);
  const stepToEvent = new Map<number, PhraseCandidate["events"][number]>();
  for (const e of phrase.events) stepToEvent.set(e.stepEighth, e);

  let strongCount = 0;
  let strongChordTone = 0;
  let strongGuide = 0;
  for (let step = 0; step < totalSteps; step += 1) {
    if (!isStrongStep(step)) continue;
    strongCount += 1;
    const e = stepToEvent.get(step);
    if (!e) continue;
    const chord = chordAtStep(song.progression, step);
    const chordPcs = chordTonePcs(chord);
    const guidePcs = guideTonePcs(chord);
    const pc = primaryPcOfEvent(e);
    if (chordPcs.includes(pc)) strongChordTone += 1;
    if (guidePcs.includes(pc)) strongGuide += 1;
  }

  const chordHitCount = phrase.events.filter((e) => e.kind === "chordHit").length;
  const chromaticCount = phrase.events.filter((e) => {
    if (e.kind !== "note") return false;
    const chord = chordAtStep(song.progression, e.stepEighth);
    const chordPcs = chordTonePcs(chord);
    return !chordPcs.includes(mod12(e.midi));
  }).length;

  const hasFSharpOnD7 = phrase.events.some((e) => {
    const chord = chordAtStep(song.progression, e.stepEighth);
    if (chord.text !== "D7") return false;
    if (e.kind === "note") return mod12(e.midi) === 6;
    return e.midis.some((m) => mod12(m) === 6);
  });

  const bullets: string[] = [];
  bullets.push(
    `Strong beats (1 & 3): chord tones ${strongChordTone}/${strongCount}, guide tones ${strongGuide}/${strongCount}`,
  );
  bullets.push(`Chromatic / tension-ish notes: ${chromaticCount} (resolution is scored)`);
  if (phrase.style === "JoePassType") bullets.push(`Chord hits: ${chordHitCount} (strum-like)`);
  if (phrase.style === "PatMartinoType")
    bullets.push(`Motif repetition emphasized (motifRate=${phrase.params.motifRate.toFixed(2)})`);
  if (phrase.style === "ChordTone4NoteType")
    bullets.push("Chord-tone-only mode: quarter-note arpeggio feel (no scale/chromatic notes).");
  if (phrase.style === "BasicGuideTone") bullets.push("Beginner mode: prioritize guide-tone landings.");

  bullets.push(
    hasFSharpOnD7
      ? "Includes F# on D7 (3rd) to strengthen resolution to Gm."
      : "F# on D7 (3rd) is weak; increasing it usually improves resolution.",
  );

  bullets.push(
    `Score snapshot: strongBeat=${score.strongBeatChordToneScore.toFixed(1)} guide=${score.guideToneScore.toFixed(
      1,
    )} voiceLead=${score.voiceLeadingScore.toFixed(1)} rhythm=${score.rhythmVarietyScore.toFixed(1)}`,
  );

  const summary = `score=${score.total.toFixed(1)} / style=${phrase.style} / level=${phrase.level} / maxFret=${phrase.params.maxFret}`;
  return { summary, bullets };
}

