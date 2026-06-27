// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { DangerZone } from "../components/dangerZone";
import { HandSize } from "../components/handSize";
import { LanguageSwitcher } from "../components/languageSwitcher";
import { MidiConnect } from "../components/midiConnect";
import { ThemeToggle } from "../components/themeToggle";
import { useMidiConnection } from "../contexts/midi";
import { useSynth } from "../hooks/useSynth";
import type { Letter } from "../lib/grade";
import type { DecayMode } from "../lib/gradeProgress";
import { loadPrefs, type NoteHints, type Prefs, savePrefs } from "../lib/prefs";
import { routeMeta } from "../lib/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/settings";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(m.nav_settings(), m.meta_settings_description());
}

export default function Settings() {
    const [prefs, setPrefs] = useState<Prefs>({
        sound: true,
        volume: 80,
        masteryThreshold: "A",
        handSpan: { left: null, right: null },
        showFingerings: true,
        noteHints: "miss",
        decayMode: "gentle",
    });
    const synth = useSynth();
    const { support: midiSupport } = useMidiConnection();

    useEffect(() => {
        setPrefs(loadPrefs());
    }, []);

    // Merge onto the latest stored prefs so a change here can't clobber one the
    // Hand size panel saved independently (handSpan isn't an input on this page).
    const update = (change: Partial<Prefs>) => {
        const next = { ...loadPrefs(), ...change };
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
                        onChange={(event) => update({ sound: event.target.checked })}
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
                        onChange={(event) => update({ volume: Number(event.target.value) })}
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
                            update({ masteryThreshold: event.target.value as Letter })
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
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    {m.settings_mastery_help()}
                </p>
            </section>

            <section className="space-y-3">
                <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {m.settings_grades()}
                </h2>
                <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                    {m.settings_decay()}
                    <select
                        value={prefs.decayMode}
                        onChange={(event) => update({ decayMode: event.target.value as DecayMode })}
                        className="rounded-md border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                    >
                        <option value="gentle">{m.settings_decay_gentle()}</option>
                        <option value="competitive">{m.settings_decay_competitive()}</option>
                    </select>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    {prefs.decayMode === "competitive"
                        ? m.settings_decay_competitive_help()
                        : m.settings_decay_gentle_help()}
                </p>
            </section>

            <section className="space-y-3">
                <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {m.settings_fingering()}
                </h2>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                        type="checkbox"
                        checked={prefs.showFingerings}
                        onChange={(event) => update({ showFingerings: event.target.checked })}
                    />
                    {m.settings_show_fingerings()}
                </label>
                <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                    {m.settings_note_hints()}
                    <select
                        value={prefs.noteHints}
                        onChange={(event) => update({ noteHints: event.target.value as NoteHints })}
                        className="rounded-md border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                    >
                        <option value="always">{m.note_hints_always()}</option>
                        <option value="miss">{m.note_hints_miss()}</option>
                        <option value="never">{m.note_hints_never()}</option>
                    </select>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    {m.settings_note_hints_help()}
                </p>
                <HandSize />
            </section>

            {/* No Web MIDI (Safari, all iOS) means no device to connect — the
                keyboard is the input there, so the whole panel is hidden. */}
            {midiSupport !== "unsupported" && (
                <section className="space-y-3">
                    <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {m.settings_connect_midi()}
                    </h2>
                    <MidiConnect />
                </section>
            )}

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

            <DangerZone />
        </main>
    );
}
