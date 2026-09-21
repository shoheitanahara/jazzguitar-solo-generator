import Link from "next/link";
import { SONG_CATALOG } from "@/lib/songs/catalog";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Songs</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Chord charts & scale maps
          </p>
        </header>

        <ul className="grid gap-3">
          {SONG_CATALOG.map((song) => (
            <li key={song.slug}>
              <Link
                href={`/songs/${song.slug}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white px-4 py-4 shadow-sm transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
              >
                <div className="grid gap-0.5">
                  <span className="text-base font-semibold">{song.title}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {song.keyCenter} · {song.bpm} BPM · {song.formLabel}
                  </span>
                </div>
                <span className="text-sm text-zinc-400">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
