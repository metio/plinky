// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { LanguageSwitcher } from "../components/languageSwitcher";
import { MidiDebugPanel } from "../components/midiDebugPanel";
import { ScoreBackup } from "../components/scoreBackup";
import { ThemeToggle } from "../components/themeToggle";
import { useSynth } from "../hooks/useSynth";
import type { Letter } from "../lib/grade";
import { loadPrefs, type Prefs, savePrefs } from "../lib/prefs";
import { routeMeta } from "../lib/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/settings";

export function meta(_args: Route.MetaArgs) {
    return routeMeta("Settings", "Configure Plinky");
}

export default function Settings() {
    const [prefs, setPrefs] = useState<Prefs>({ sound: true, volume: 80, masteryThreshold: "A" });
    const synth = useSynth();

    useEffect(() => {
        setPrefs(loadPrefs());
    }, []);

    const update = (next: Prefs) => {
        setPrefs(next);
        savePrefs(next);
    };

    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.nav_settings()}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{m.settings_subtitle()}</p>
            </header>

            <section className="space-y-3">
                <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {m.settings_appearance()}
                </h2>
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                        {m.settings_theme()}
                    </span>
                    <ThemeToggle />
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                        {m.settings_language()}
                    </span>
                    <LanguageSwitcher />
                </div>
            </section>

            <section className="space-y-3">
                <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {m.settings_sound()}
                </h2>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                        type="checkbox"
                        checked={prefs.sound}
                        onChange={(event) => update({ ...prefs, sound: event.target.checked })}
                    />
                    {m.settings_play_sounds()}
                </label>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                        {m.settings_volume()}
                    </span>
                    <input
                        type="range"
                        aria-label={m.settings_volume()}
                        min={0}
                        max={100}
                        value={prefs.volume}
                        disabled={!prefs.sound}
                        onChange={(event) =>
                            update({ ...prefs, volume: Number(event.target.value) })
                        }
                    />
                    <span className="w-8 font-mono text-sm tabular-nums">{prefs.volume}</span>
                    <button
                        type="button"
                        onClick={() => synth.playNote(72)}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
                    >
                        {m.settings_test()}
                    </button>
                </div>
            </section>

            <section className="space-y-3">
                <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {m.settings_mastery()}
                </h2>
                <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                    {m.settings_mastery_threshold()}
                    <select
                        value={prefs.masteryThreshold}
                        onChange={(event) =>
                            update({ ...prefs, masteryThreshold: event.target.value as Letter })
                        }
                        className="rounded-md border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                    >
                        {(["S", "A", "B", "C", "D"] as Letter[]).map((letter) => (
                            <option key={letter} value={letter}>
                                {letter}
                            </option>
                        ))}
                    </select>
                </label>
            </section>

            <ScoreBackup />

            <section className="space-y-3">
                <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {m.settings_midi_device()}
                </h2>
                <MidiDebugPanel />
            </section>

            <section className="space-y-3">
                <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {m.settings_help()}
                </h2>
                <a
                    href="https://github.com/metio/plinky/issues"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-indigo-700 underline dark:text-indigo-300"
                >
                    {m.settings_get_help()} →
                </a>
            </section>
        </main>
    );
}
