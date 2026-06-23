// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { MidiDebugPanel } from "../components/midiDebugPanel";
import { ThemeToggle } from "../components/themeToggle";
import { useSynth } from "../hooks/useSynth";
import { loadPrefs, type Prefs, savePrefs } from "../lib/prefs";
import type { Route } from "./+types/settings";

export function meta(_args: Route.MetaArgs) {
    return [{ title: "Plinky - Settings" }, { name: "description", content: "Configure Plinky" }];
}

export default function Settings() {
    const [prefs, setPrefs] = useState<Prefs>({ sound: true, volume: 80 });
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
                <h1 className="text-2xl font-semibold">Settings</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Preferences are saved on this device.
                </p>
            </header>

            <section className="space-y-3">
                <h2 className="text-sm font-medium uppercase tracking-wide text-gray-400">
                    Appearance
                </h2>
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Theme</span>
                    <ThemeToggle />
                </div>
            </section>

            <section className="space-y-3">
                <h2 className="text-sm font-medium uppercase tracking-wide text-gray-400">Sound</h2>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                        type="checkbox"
                        checked={prefs.sound}
                        onChange={(event) => update({ ...prefs, sound: event.target.checked })}
                    />
                    Play note sounds
                </label>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Volume</span>
                    <input
                        type="range"
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
                        Test
                    </button>
                </div>
            </section>

            <section className="space-y-3">
                <h2 className="text-sm font-medium uppercase tracking-wide text-gray-400">
                    MIDI device
                </h2>
                <MidiDebugPanel />
            </section>
        </main>
    );
}
