// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { Button } from "../components/ui/button";
import { linkClasses } from "../components/ui/classes";
import { ChoiceField, SwitchField } from "../components/ui/fields";
import {
    BookIcon,
    EyeIcon,
    FingersIcon,
    GradCapIcon,
    KeysIcon,
    MetronomeIcon,
    MicIcon,
    PlugIcon,
    QuestionIcon,
    SlidersIcon,
    SpeakerIcon,
    StarIcon,
} from "../components/ui/icons";
import { Keyboard } from "../components/ui/keyboard";
import { SettingsSection } from "../components/ui/settingsSection";

import { DangerZone } from "../components/features/dangerZone";
import { HandSize } from "../components/features/handSize";
import { ReadingLevel } from "../components/features/readingLevel";
import { KeyMapping } from "../components/features/keyMapping";
import { LanguageSwitcher } from "../components/ui/languageSwitcher";
import { LocalizedLink } from "../components/ui/localizedLink";
import { MicConnect } from "../components/features/micConnect";
import { MidiConnect } from "../components/features/midiConnect";
import { ThemeToggle } from "../components/features/themeToggle";
import { useMidiConnection } from "../contexts/midi";
import { usePrefs } from "../hooks/usePrefs";
import { useSynth } from "../hooks/useSynth";
import type { Letter } from "../../core/grade";
import type { DecayMode } from "../../core/review";
import type { Beams } from "../../core/beams";
import { BARS_PER_ROW, METRONOME_SUBDIVISIONS, NOTE_SCALES, REVEAL_TRIES } from "../../core/prefs";
import { type NoteHints, type NoteLabels, REVIEW_CAPS } from "../../core/prefs";
import { noindexMeta, routeMeta } from "../../core/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/settings";

export function meta(_args: Route.MetaArgs) {
    // A utility page for the visitor's own device — no place in the index, so
    // noindex it (and it is left out of the sitemap).
    return [...routeMeta(m.nav_settings(), m.meta_settings_description()), noindexMeta()];
}

const ICON = "h-5 w-5";

export default function Settings() {
    const { prefs, update } = usePrefs();
    const synth = useSynth();
    const { support: midiSupport, micStatus } = useMidiConnection();

    return (
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.nav_settings()}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{m.settings_subtitle()}</p>
            </header>

            {/* Privacy leads the page: these opt-ins involve a third party and are
            off unless turned on, so they sit up top where they're seen. The analytics
            toggle lives here now; a monetisation opt-in joins it later. */}
            <SettingsSection
                title={m.settings_privacy_title()}
                hint={m.settings_privacy_hint()}
                icon={<EyeIcon className={ICON} />}
            >
                <div className="space-y-1">
                    <SwitchField
                        label={m.settings_analytics_toggle()}
                        checked={prefs.analyticsConsent}
                        onChange={(analyticsConsent) => update({ analyticsConsent })}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {m.settings_analytics_desc()}{" "}
                        <LocalizedLink to="/datenschutz" className={linkClasses}>
                            {m.settings_analytics_link()}
                        </LocalizedLink>
                    </p>
                </div>
            </SettingsSection>

            <SettingsSection
                title={m.settings_appearance()}
                hint={m.settings_appearance_hint()}
                icon={<SlidersIcon className={ICON} />}
            >
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
            </SettingsSection>

            <SettingsSection
                title={m.settings_sound()}
                hint={m.settings_sound_hint()}
                icon={<SpeakerIcon className={ICON} />}
            >
                <SwitchField
                    label={m.settings_play_sounds()}
                    checked={prefs.sound}
                    onChange={(sound) => update({ sound })}
                />
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
            </SettingsSection>

            <SettingsSection
                title={m.settings_mastery()}
                hint={m.settings_mastery_hint()}
                icon={<GradCapIcon className={ICON} />}
            >
                <ChoiceField
                    label={m.settings_mastery_threshold()}
                    value={prefs.masteryThreshold}
                    onChange={(masteryThreshold: Letter) => update({ masteryThreshold })}
                    options={(["S", "A", "B", "C", "D"] as Letter[]).map((letter) => ({
                        id: letter,
                        label: letter,
                    }))}
                    help={m.settings_mastery_help()}
                />
            </SettingsSection>

            <SettingsSection
                title={m.settings_grades()}
                hint={m.settings_grades_hint()}
                icon={<StarIcon className={ICON} />}
            >
                <ChoiceField
                    label={m.settings_decay()}
                    value={prefs.decayMode}
                    onChange={(decayMode: DecayMode) => update({ decayMode })}
                    options={[
                        { id: "gentle", label: m.settings_decay_gentle() },
                        { id: "competitive", label: m.settings_decay_competitive() },
                    ]}
                    help={
                        prefs.decayMode === "competitive"
                            ? m.settings_decay_competitive_help()
                            : m.settings_decay_gentle_help()
                    }
                />
                <ChoiceField
                    label={m.settings_review_cap()}
                    value={String(prefs.reviewCap)}
                    onChange={(value) => update({ reviewCap: Number(value) })}
                    options={REVIEW_CAPS.map((cap) => ({ id: String(cap), label: String(cap) }))}
                    help={m.settings_review_cap_help()}
                />
            </SettingsSection>

            <SettingsSection
                title={m.settings_fingering()}
                hint={m.settings_fingering_hint()}
                icon={<FingersIcon className={ICON} />}
            >
                <SwitchField
                    label={m.settings_show_fingerings()}
                    checked={prefs.showFingerings}
                    onChange={(showFingerings) => update({ showFingerings })}
                />
                <ChoiceField
                    label={m.settings_note_hints()}
                    value={prefs.noteHints}
                    onChange={(noteHints: NoteHints) => update({ noteHints })}
                    options={[
                        { id: "always", label: m.note_hints_always() },
                        { id: "miss", label: m.note_hints_miss() },
                        { id: "never", label: m.note_hints_never() },
                    ]}
                    help={m.settings_note_hints_help()}
                />
                <ChoiceField
                    label={m.settings_note_labels()}
                    value={prefs.noteLabels}
                    onChange={(noteLabels: NoteLabels) => update({ noteLabels })}
                    options={[
                        { id: "all", label: m.note_labels_all() },
                        { id: "c", label: m.note_labels_c() },
                        { id: "off", label: m.note_labels_off() },
                    ]}
                    help={m.settings_note_labels_help()}
                />
                {/* The choice, demonstrated: a real octave that re-labels itself as the
                    pick above changes, and plays when tapped — the same keyboard the
                    practice modes render. */}
                <div className="space-y-1">
                    <Keyboard
                        from={60}
                        to={72}
                        labels={prefs.noteLabels}
                        well="w-full max-w-sm"
                        onPress={(note) => synth.playNote(note)}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {m.settings_labels_example()}
                    </p>
                </div>
                <HandSize />
            </SettingsSection>

            {/* Reading: the level preset up top sets the aids together, then every
            reading and layout preference the run-setup panel offers, so the two
            surfaces are one set of prefs reached from two places. */}
            <SettingsSection
                title={m.settings_reading_title()}
                hint={m.settings_reading_hint()}
                icon={<BookIcon className={ICON} />}
            >
                <ReadingLevel />
                <SwitchField
                    label={m.color_notes_toggle()}
                    checked={prefs.colorNotes}
                    onChange={(colorNotes) => update({ colorNotes })}
                    help={m.color_notes_hint()}
                />
                <SwitchField
                    label={m.highway_toggle()}
                    checked={prefs.highway}
                    onChange={(highway) => update({ highway })}
                    help={m.highway_hint()}
                />
                <SwitchField
                    label={m.forgiving_toggle()}
                    checked={prefs.forgiving}
                    onChange={(forgiving) => update({ forgiving })}
                />
                <SwitchField
                    label={m.treadmill_toggle()}
                    checked={prefs.treadmill}
                    onChange={(treadmill) => update({ treadmill })}
                    help={m.treadmill_hint()}
                />
                <SwitchField
                    label={m.bar_numbers_toggle()}
                    checked={prefs.barNumbers}
                    onChange={(barNumbers) => update({ barNumbers })}
                    help={m.bar_numbers_hint()}
                />
                <ChoiceField
                    label={m.bars_per_row()}
                    value={String(prefs.barsPerRow)}
                    onChange={(id) => update({ barsPerRow: Number(id) })}
                    options={BARS_PER_ROW.map((n) => ({
                        id: String(n),
                        label: n === 0 ? m.bars_per_row_auto() : String(n),
                    }))}
                    help={m.bars_per_row_caption()}
                />
                <ChoiceField
                    label={m.note_size_label()}
                    value={String(prefs.noteScale)}
                    onChange={(id) => update({ noteScale: Number(id) })}
                    options={NOTE_SCALES.map((scale) => ({
                        id: String(scale),
                        label: `${Math.round(scale * 100)}%`,
                    }))}
                    help={m.note_size_caption()}
                />
                <ChoiceField
                    label={m.beams_label()}
                    value={prefs.beams}
                    onChange={(beams: Beams) => update({ beams })}
                    options={[
                        { id: "auto", label: m.beams_auto() },
                        { id: "on", label: m.beams_on() },
                        { id: "off", label: m.beams_off() },
                    ]}
                    help={m.beams_caption()}
                />
                <SwitchField
                    label={m.race_ghost_toggle()}
                    checked={prefs.raceGhost}
                    onChange={(raceGhost) => update({ raceGhost })}
                    help={m.race_ghost_hint()}
                />
                <SwitchField
                    label={m.hidden_notes_toggle()}
                    checked={prefs.hiddenNotes}
                    onChange={(hiddenNotes) => update({ hiddenNotes })}
                    help={m.hidden_notes_hint()}
                />
                {prefs.hiddenNotes && (
                    <ChoiceField
                        label={m.reveal_tries()}
                        value={String(prefs.revealTries)}
                        onChange={(id) => update({ revealTries: Number(id) })}
                        options={REVEAL_TRIES.map((n) => ({ id: String(n), label: String(n) }))}
                        help={m.reveal_tries_caption()}
                    />
                )}
            </SettingsSection>

            <SettingsSection
                title={m.settings_metronome()}
                hint={m.settings_metronome_hint()}
                icon={<MetronomeIcon className={ICON} />}
            >
                <ChoiceField
                    label={m.metronome_subdivision()}
                    value={String(prefs.metronomeSubdivision)}
                    onChange={(value) => update({ metronomeSubdivision: Number(value) })}
                    options={METRONOME_SUBDIVISIONS.map((n) => ({
                        id: String(n),
                        label: String(n),
                    }))}
                    help={m.metronome_subdivision_caption()}
                />
                <SwitchField
                    label={m.metronome_accent()}
                    checked={prefs.metronomeAccent}
                    onChange={(metronomeAccent) => update({ metronomeAccent })}
                />
                <SwitchField
                    label={m.metronome_adaptive()}
                    checked={prefs.metronomeAdaptive}
                    onChange={(metronomeAdaptive) => update({ metronomeAdaptive })}
                />
            </SettingsSection>

            <SettingsSection title={m.settings_keyboard()} icon={<KeysIcon className={ICON} />}>
                <KeyMapping />
            </SettingsSection>

            {/* No Web MIDI (Safari, all iOS) means no device to connect — the
                keyboard is the input there, so the whole panel is hidden. */}
            {midiSupport !== "unsupported" && (
                <SettingsSection
                    title={m.settings_connect_midi()}
                    hint={m.settings_midi_hint()}
                    icon={<PlugIcon className={ICON} />}
                >
                    <MidiConnect />
                </SettingsSection>
            )}

            {/* No microphone API (very old browsers, some webviews) means nothing
                to listen with, so the whole panel is hidden. */}
            {micStatus !== "unsupported" && (
                <SettingsSection
                    title={m.mic_heading()}
                    hint={m.mic_hint()}
                    icon={<MicIcon className={ICON} />}
                >
                    <MicConnect />
                </SettingsSection>
            )}

            <SettingsSection title={m.settings_help()} icon={<QuestionIcon className={ICON} />}>
                <a
                    href="https://github.com/metio/plinky/issues"
                    target="_blank"
                    rel="noreferrer"
                    className={`text-sm ${linkClasses}`}
                >
                    {m.settings_get_help()} →
                </a>
            </SettingsSection>

            <DangerZone />
        </main>
    );
}
