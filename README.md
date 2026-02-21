## Jazz Guitar Solo Generator (MVP)

A personal mini app for practicing over **Autumn Leaves** (assumed key center: **G minor**) by:

- Showing the chord progression (8-bar loop)
- Generating ranked guitar TAB ideas you can memorize and play along with
- Providing a short explanation of note choices
- Playing the chord progression via Tone.js (BPM, swing, comping grid)

The generator is **not** pure random. Internally it uses:
**constraints (rules) → candidate generation → scoring → diversity filtering**.

## Getting Started

### Setup

```bash
npm i
npm run dev
```

Open `http://localhost:3000`.

## How to use

- **Style / Level**: Select a style profile and difficulty level.
- **Seed**:
  - **Locked**: same seed → same results (reproducible)
  - **Random**: changes the seed every time you click Generate
- **Generate**: Generates a pool of candidates internally and shows the top ranked picks.
- **Chord playback** (sticky footer): Start/Stop, BPM, Swing (triplet feel), Comping grid (8th/quarter).

## Generator architecture (high level)

Core logic is under `lib/`.

- **Song/progression data**: `lib/songs/autumnLeavesGm.ts`
- **Music model**: `lib/music/*` (chords, chord tones / guide tones, progression lookup)
- **Idiom “forms” dictionary**: `lib/forms.ts` (2-beat patterns with space/rests)
- **Candidate generation**: `lib/generator.ts`
  - Strong beats prefer chord tones, especially **3rd/7th (guide tones)**
  - D7 includes **F# (3rd)** frequently to strengthen resolution to Gm
  - Uses idiom forms + additional recipes (approach/enclosure/motif/chord hits)
- **Scoring**: `lib/scoring.ts` (strong-beat targets, voice-leading, resolution, range/leap, rhythm variety, etc.)
- **Diversity filter**: `lib/diversity.ts` (rhythm bits + pitch-class n-grams)
- **TAB + fingering**: `lib/tab.ts`
  - Enumerates playable string/fret options
  - Picks a low-cost path via DP (reduces string hopping, avoids unplayable chord spans)
  - Renders 6-string TAB with chord names aligned to the 8th-note grid

## Sound / strum tuning

Adjust `lib/audio.ts` `DEFAULT_GUITAR_LIKE_SETTINGS`:

- **Strum feel**: `strumMinMs` / `strumMaxMs`
- **Reverb**: `reverbWet` / `reverbDecay`
- **Envelope**: `attack` / `decay` / `sustain` / `release`
- **Swing**: `swingAmount`
- **Comping grid**: `compSubdivision` ("eighth" / "quarter")

## Key files

- `app/page.tsx`: Single-page UI
- `components/*`: UI components
- `lib/*`: Generator + audio + music logic
