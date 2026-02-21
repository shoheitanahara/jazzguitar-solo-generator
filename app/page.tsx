"use client";

import * as React from "react";
import { AUTUMN_LEAVES_GM_8BARS } from "@/lib/songs/autumnLeavesGm";
import { formatChordChartBars } from "@/lib/music/progression";
import type { Level, Style } from "@/lib/generator";
import { generateRankedTabs } from "@/lib/engine";
import { getChordLooper, type ChordLooper } from "@/lib/audio";
import { Controls } from "@/components/Controls";
import { ChordChart } from "@/components/ChordChart";
import { GeneratedList } from "@/components/GeneratedList";
import { Explanation } from "@/components/Explanation";
import { AudioControls } from "@/components/AudioControls";
import { paramsForStyle } from "@/lib/stylePresets";

const OUTPUT_SIZE = 5;
const POOL_SIZE = 160;

export default function Home() {
  const song = AUTUMN_LEAVES_GM_8BARS;
  const chordLines = React.useMemo(() => formatChordChartBars(song.progression.bars), [song]);

  const [style, setStyle] = React.useState<Style>("JoePassType");
  const [level, setLevel] = React.useState<Level>(3);
  const [seedText, setSeedText] = React.useState<string>("20260221");
  const [isSeedLocked, setIsSeedLocked] = React.useState<boolean>(true);

  const [isGenerating, setIsGenerating] = React.useState(false);

  const [items, setItems] = React.useState<ReturnType<typeof generateRankedTabs>["items"]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const [bpm, setBpm] = React.useState<number>(120);
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false);
  const [swingAmount, setSwingAmount] = React.useState<number>(0.6);
  const [compSubdivision, setCompSubdivision] = React.useState<"quarter" | "eighth">("eighth");
  const looperRef = React.useRef<ChordLooper | null>(null);

  React.useEffect(() => {
    return () => {
      try {
        looperRef.current?.stop();
      } catch {
        // no-op: Toneが未初期化の場合など
      }
    };
  }, []);

  const selected = React.useMemo(() => items.find((x) => x.id === selectedId) ?? null, [items, selectedId]);

  const makeRandomSeedText = React.useCallback(() => {
    const rand =
      typeof crypto !== "undefined" && "getRandomValues" in crypto
        ? crypto.getRandomValues(new Uint32Array(1))[0]!.toString(16)
        : Math.floor(Math.random() * 1e9).toString(16);
    return `${Date.now().toString(16)}-${rand}`;
  }, []);

  const onGenerate = async () => {
    setIsGenerating(true);
    try {
      // UIスレッドを塞ぎすぎないように、短いyieldを入れる
      await new Promise((r) => setTimeout(r, 0));

      const seedTextUsed = isSeedLocked ? seedText : makeRandomSeedText();
      const res = generateRankedTabs({
        song,
        style,
        level,
        params: paramsForStyle(style, level),
        seedText: seedTextUsed,
        poolSize: POOL_SIZE,
        outputSize: OUTPUT_SIZE,
      });
      setItems(res.items);
      setSelectedId(res.items[0]?.id ?? null);
      if (!isSeedLocked) setSeedText(seedTextUsed);
    } finally {
      setIsGenerating(false);
    }
  };

  const onStart = async () => {
    const looper = looperRef.current ?? getChordLooper();
    looperRef.current = looper;
    looper.setSettings({ swingAmount, compSubdivision });
    await looper.start(song, bpm);
    setIsPlaying(true);
  };

  const onStop = () => {
    looperRef.current?.stop();
    setIsPlaying(false);
  };

  const onChangeBpm = (next: number) => {
    const v = Math.round(next);
    setBpm(v);
    if (isPlaying) looperRef.current?.setBpm(v);
  };

  const onChangeSwingAmount = (next: number) => {
    const v = Math.max(0, Math.min(0.9, Number(next)));
    setSwingAmount(v);
    if (isPlaying) looperRef.current?.setSettings({ swingAmount: v });
  };

  const onChangeCompSubdivision = (next: "quarter" | "eighth") => {
    setCompSubdivision(next);
    if (isPlaying) looperRef.current?.setSettings({ compSubdivision: next });
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 pb-44 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="grid gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Jazz Practice Mini App (MVP)</h1>
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Generate ranked guitar TAB ideas over the 8-bar loop of “Autumn Leaves” (Gm).
          </p>
        </header>

        <ChordChart
          title="Chord Progression (8-bar loop)"
          subtitle={`Autumn Leaves · Key: ${song.keyCenter}`}
          lines={chordLines}
        />

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">Generator</h2>
          </div>
          <Controls
            style={style}
            level={level}
            seedText={seedText}
            isSeedLocked={isSeedLocked}
            isGenerating={isGenerating}
            onChange={(next) => {
              if (next.style) setStyle(next.style);
              if (next.level) setLevel(next.level);
              if (next.seedText != null) setSeedText(next.seedText);
              if (next.isSeedLocked != null) setIsSeedLocked(next.isSeedLocked);
            }}
            onGenerate={() => void onGenerate()}
          />
        </section>

        <GeneratedList items={items} selectedId={selectedId} onSelect={setSelectedId} />
        <Explanation selected={selected} />

        <footer className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          TAB uses an 8th-note grid and wraps every 4 bars.
        </footer>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto w-full max-w-5xl px-4 py-3">
          <AudioControls
            variant="footer"
            bpm={bpm}
            isPlaying={isPlaying}
            swingAmount={swingAmount}
            compSubdivision={compSubdivision}
            onChangeBpm={onChangeBpm}
            onChangeSwingAmount={onChangeSwingAmount}
            onChangeCompSubdivision={onChangeCompSubdivision}
            onStart={() => void onStart()}
            onStop={onStop}
          />
        </div>
      </div>
    </div>
  );
}
