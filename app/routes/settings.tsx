// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type ReactNode, useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { linkClasses } from "../components/ui/classes";
import { DangerZone } from "../components/features/dangerZone";
import { HandSize } from "../components/features/handSize";
import { KeyMapping } from "../components/features/keyMapping";
import { LanguageSwitcher } from "../components/ui/languageSwitcher";
import { MidiConnect } from "../components/features/midiConnect";
import { ThemeToggle } from "../components/features/themeToggle";
import { useMidiConnection } from "../contexts/midi";
import { useSynth } from "../hooks/useSynth";
import type { Letter } from "../../core/grade";
import type { DecayMode } from "../../core/review";
import { DEFAULT_KEY_MAP } from "../../core/keyMap";
import { METRONOME_SUBDIVISIONS } from "../../core/prefs";
import { type NoteHints, type NoteLabels, type Prefs, REVIEW_CAPS } from "../../core/prefs";
import { usePrefsStore } from "../contexts/services";
import { routeMeta } from "../../core/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/settings";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(m.nav_settings(), m.meta_settings_description());
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {title}
            </h2>
            {children}
        </section>
    );
}

function SelectField({
    label,
    value,
    onChange,
    options,
    help,
}: {
    label: string;
    value: string | number;
    onChange: (value: string) => void;
    options: readonly { value: string | number; label: string }[];
    help?: string;
}) {
    return (
        <>
            <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                {label}
                <select
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
                >
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </label>
            {help !== undefined && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{help}</p>
            )}
        </>
    );
}

export default function Settings() {
    const prefsStore = usePrefsStore();
    const [prefs, setPrefs] = useState<Prefs>({
        sound: true,
        volume: 80,
        masteryThreshold: "A",
        handSpan: { left: null, right: null },
        showFingerings: false,
        noteHints: "miss",
        noteLabels: "c",
        forgiving: false,
        fingerHints: true,
        decayMode: "gentle",
        reviewCap: 8,
        barsPerRow: 0,
        barNumbers: true,
        keyMap: DEFAULT_KEY_MAP,
        metronomeSubdivision: 1,
        metronomeAccent: true,
        metronomeAdaptive: false,
        treadmill: false,
        raceGhost: true,
        hiddenNotes: false,
        revealTries: 1,
    });
    const synth = useSynth();
    const { support: midiSupport } = useMidiConnection();

    useEffect(() => {
        setPrefs(prefsStore.load());
    }, [prefsStore.load]);

    // Merge onto the latest stored prefs so a change here can't clobber one the
    // Hand size panel saved independently (handSpan isn't an input on this page).
    const update = (change: Partial<Prefs>) => {
        const next = { ...prefsStore.load(), ...change };
        setPrefs(next);
        prefsStore.save(next);
    };

    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.nav_settings()}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{m.settings_subtitle()}</p>
            </header>

            <Section title={m.settings_appearance()}>
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
            </Section>

            <Section title={m.settings_sound()}>
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
                    <Button variant="secondary" onClick={() => synth.playNote(72)}>
                        {m.settings_test()}
                    </Button>
                </div>
            </Section>

            <Section title={m.settings_mastery()}>
                <SelectField
                    label={m.settings_mastery_threshold()}
                    value={prefs.masteryThreshold}
                    onChange={(value) => update({ masteryThreshold: value as Letter })}
                    options={(["S", "A", "B", "C", "D"] as Letter[]).map((letter) => ({
                        value: letter,
                        label: letter,
                    }))}
                    help={m.settings_mastery_help()}
                />
            </Section>

            <Section title={m.settings_grades()}>
                <SelectField
                    label={m.settings_decay()}
                    value={prefs.decayMode}
                    onChange={(value) => update({ decayMode: value as DecayMode })}
                    options={[
                        { value: "gentle", label: m.settings_decay_gentle() },
                        { value: "competitive", label: m.settings_decay_competitive() },
                    ]}
                    help={
                        prefs.decayMode === "competitive"
                            ? m.settings_decay_competitive_help()
                            : m.settings_decay_gentle_help()
                    }
                />
                <SelectField
                    label={m.settings_review_cap()}
                    value={prefs.reviewCap}
                    onChange={(value) => update({ reviewCap: Number(value) })}
                    options={REVIEW_CAPS.map((cap) => ({ value: cap, label: String(cap) }))}
                    help={m.settings_review_cap_help()}
                />
            </Section>

            <Section title={m.settings_fingering()}>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                        type="checkbox"
                        checked={prefs.showFingerings}
                        onChange={(event) => update({ showFingerings: event.target.checked })}
                    />
                    {m.settings_show_fingerings()}
                </label>
                <SelectField
                    label={m.settings_note_hints()}
                    value={prefs.noteHints}
                    onChange={(value) => update({ noteHints: value as NoteHints })}
                    options={[
                        { value: "always", label: m.note_hints_always() },
                        { value: "miss", label: m.note_hints_miss() },
                        { value: "never", label: m.note_hints_never() },
                    ]}
                    help={m.settings_note_hints_help()}
                />
                <SelectField
                    label={m.settings_note_labels()}
                    value={prefs.noteLabels}
                    onChange={(value) => update({ noteLabels: value as NoteLabels })}
                    options={[
                        { value: "all", label: m.note_labels_all() },
                        { value: "c", label: m.note_labels_c() },
                        { value: "off", label: m.note_labels_off() },
                    ]}
                    help={m.settings_note_labels_help()}
                />
                <HandSize />
            </Section>

            <Section title={m.settings_metronome()}>
                <SelectField
                    label={m.metronome_subdivision()}
                    value={String(prefs.metronomeSubdivision)}
                    onChange={(value) => update({ metronomeSubdivision: Number(value) })}
                    options={METRONOME_SUBDIVISIONS.map((n) => ({
                        value: String(n),
                        label: String(n),
                    }))}
                    help={m.metronome_subdivision_caption()}
                />
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={prefs.metronomeAccent}
                        onChange={(event) => update({ metronomeAccent: event.target.checked })}
                    />
                    {m.metronome_accent()}
                </label>
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={prefs.metronomeAdaptive}
                        onChange={(event) => update({ metronomeAdaptive: event.target.checked })}
                    />
                    {m.metronome_adaptive()}
                </label>
            </Section>

            <Section title={m.settings_keyboard()}>
                <KeyMapping />
            </Section>

            {/* No Web MIDI (Safari, all iOS) means no device to connect — the
                keyboard is the input there, so the whole panel is hidden. */}
            {midiSupport !== "unsupported" && (
                <Section title={m.settings_connect_midi()}>
                    <MidiConnect />
                </Section>
            )}

            <Section title={m.settings_help()}>
                <a
                    href="https://github.com/metio/plinky/issues"
                    target="_blank"
                    rel="noreferrer"
                    className={`text-sm ${linkClasses}`}
                >
                    {m.settings_get_help()} →
                </a>
            </Section>

            <DangerZone />
        </main>
    );
}
