// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Button } from "../components/ui/button";
import { linkClasses } from "../components/ui/classes";
import { ChoiceField, SliderField, SwitchField } from "../components/ui/fields";
import {
    BookIcon,
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
import { GrandPianoSetting } from "../components/features/grandPianoSetting";
import { InstrumentRangeSetting } from "../components/features/instrumentRangeSetting";
import { SettingsSection } from "../components/ui/settingsSection";

import { DangerZone } from "../components/features/dangerZone";
import { FeatureBoundary } from "../components/features/featureBoundary";
import { ProgressBackup } from "../components/features/progressBackup";
import { RecentProblems } from "../components/features/recentProblems";
import { HandSize } from "../components/features/handSize";
import { ReadingLevel } from "../components/features/readingLevel";
import { KeyMapping } from "../components/features/keyMapping";
import {
    KeyboardFinishPicker,
    KeyboardThemePicker,
} from "../components/features/keyboardThemePicker";
import { LanguageSwitcher } from "../components/ui/languageSwitcher";
import { MicConnect } from "../components/features/micConnect";
import { MidiConnect } from "../components/features/midiConnect";
import { KeyLightsSettings } from "../components/features/keyLightsSettings";
import { ThemeToggle } from "../components/features/themeToggle";
import { useMidiConnection } from "../contexts/midi";
import { usePrefs } from "../hooks/usePrefs";
import { useSynth } from "../hooks/useSynth";
import type { Letter } from "../../core/grade";
import type { DecayMode } from "../../core/review";
import type { Beams } from "../../core/beams";
import { type Groove, GROOVES } from "../../core/groove";
import { BARS_PER_ROW, METRONOME_SUBDIVISIONS, NOTE_SCALES, REVEAL_TRIES } from "../../core/prefs";
import { type NoteHints, type NoteLabels, type Prefs, REVIEW_CAPS } from "../../core/prefs";
import { noindexMeta, routeMeta } from "../../core/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/settings";
import { PageHeader } from "../components/ui/pageHeader";
import { useScrollToHash } from "../hooks/useScrollToHash";

export function meta(_args: Route.MetaArgs) {
    // A utility page for the visitor's own device — no place in the index, so
    // noindex it (and it is left out of the sitemap).
    return [...routeMeta(m.nav_settings(), m.meta_settings_description()), noindexMeta()];
}

const ICON = "h-5 w-5";

function grooveLabel(groove: Groove): string {
    switch (groove) {
        case "backbeat":
            return m.groove_backbeat();
        case "twoFeel":
            return m.groove_two_feel();
        default:
            return m.groove_straight();
    }
}

export default function Settings() {
    // Land on the setting the reader was sent for. The front page points at the three
    // people actually get stuck on — a piano to connect, the computer keys, the hand a
    // fingering has to fit — and a client-router navigation does not act on the hash by
    // itself, so a link to one of them otherwise arrived at the top of a long page.
    useScrollToHash();

    const { prefs, update } = usePrefs();
    const synth = useSynth();
    const { support: midiSupport, micStatus, keyLights, devices } = useMidiConnection();

    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <PageHeader title={m.nav_settings()} hint={m.settings_subtitle()} />
            {/* Each control is guarded on its own, INSIDE its section rather than around
                it: the heading and the hint are copy that cannot fail, and leaving them
                standing means a panel that breaks still says which setting it was. This
                page is also where the two recovery tools live — the backup and the danger
                zone — so keeping one broken control from taking the page is the
                difference between a bad state you can get out of and one you cannot. */}
            {/* Settings are ordered by what somebody came here to change, not by which
                part of the app owns them: first the instrument you play on, then how the
                music reads while you play it, then what counts as learned, and last the
                device itself. Before this the first thing on the page was the theme
                picker and the microphone was tenth. */}
            {/* No Web MIDI (Safari, all iOS) means no device to connect — the
                keyboard is the input there, so the whole panel is hidden. */}
            {midiSupport !== "unsupported" && (
                <SettingsSection
                    anchor="midi"
                    title={m.settings_connect_midi()}
                    hint={m.settings_midi_hint()}
                    icon={<PlugIcon className={ICON} />}
                >
                    <FeatureBoundary feature="MidiConnect">
                        <MidiConnect />
                    </FeatureBoundary>
                    <SwitchField
                        label={m.settings_instrument_sounds()}
                        checked={prefs.instrumentSounds}
                        onChange={(instrumentSounds) => update({ instrumentSounds })}
                        help={m.settings_instrument_sounds_help()}
                    />
                    <SwitchField
                        label={m.settings_midi_echo()}
                        checked={prefs.midiEcho}
                        onChange={(midiEcho) => update({ midiEcho })}
                        help={m.settings_midi_echo_help()}
                    />
                    <KeyLightsSettings
                        prefs={prefs}
                        update={update}
                        keyLights={keyLights}
                        deviceNames={devices.map((device) => device.name)}
                    />
                    <FeatureBoundary feature="InstrumentRangeSetting">
                        <InstrumentRangeSetting />
                    </FeatureBoundary>
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
                    <FeatureBoundary feature="MicConnect">
                        <MicConnect />
                    </FeatureBoundary>
                </SettingsSection>
            )}

            <SettingsSection
                anchor="keys"
                title={m.settings_keyboard()}
                icon={<KeysIcon className={ICON} />}
            >
                <FeatureBoundary feature="KeyMapping">
                    <KeyMapping />
                </FeatureBoundary>
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
                <FeatureBoundary feature="GrandPianoSetting">
                    <GrandPianoSetting />
                </FeatureBoundary>
                <SliderField
                    label={m.settings_volume()}
                    value={prefs.volume}
                    disabled={!prefs.sound}
                    onChange={(volume) => update({ volume })}
                />
                <div className="space-y-1">
                    <SliderField
                        label={m.settings_reverb()}
                        value={prefs.reverb}
                        disabled={!prefs.sound}
                        onChange={(reverb) => update({ reverb })}
                    />
                    <p className="text-xs text-muted">{m.settings_reverb_hint()}</p>
                </div>
                {/* Below both sliders rather than beside one of them: a test note sounds at
                    the volume AND in the room, so it belongs to the pair. It also lets the
                    two readings line up, which they cannot when one row carries a button. */}
                <Button variant="secondary" onClick={() => synth.playNote(72)}>
                    {m.settings_test()}
                </Button>
            </SettingsSection>

            {/* Reading: the level preset up top sets the aids together, then every
            reading and layout preference the run-setup panel offers, so the two
            surfaces are one set of prefs reached from two places. */}
            <SettingsSection
                title={m.settings_reading_title()}
                hint={m.settings_reading_hint()}
                icon={<BookIcon className={ICON} />}
            >
                <FeatureBoundary feature="ReadingLevel">
                    <ReadingLevel />
                </FeatureBoundary>
                <SwitchField
                    label={m.color_notes_toggle()}
                    checked={prefs.colorNotes}
                    onChange={(colorNotes) => update({ colorNotes })}
                    help={m.color_notes_hint()}
                />
                <SwitchField
                    label={m.accompaniment_toggle()}
                    checked={prefs.showAccompaniment}
                    onChange={(showAccompaniment) => update({ showAccompaniment })}
                    help={m.accompaniment_hint()}
                />
                <ChoiceField
                    label={m.reduction_label()}
                    value={prefs.reduction}
                    onChange={(id) => update({ reduction: id as Prefs["reduction"] })}
                    options={[
                        { id: "", label: m.reduction_none() },
                        { id: "thinned", label: m.reduction_thinned() },
                        { id: "outlined", label: m.reduction_outlined() },
                        { id: "melody", label: m.reduction_melody() },
                    ]}
                    help={m.reduction_caption()}
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
                anchor="hand"
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
                        { id: "solfege", label: m.note_labels_solfege() },
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
                    <p className="text-xs text-muted">{m.settings_labels_example()}</p>
                </div>
                <FeatureBoundary feature="HandSize">
                    <HandSize />
                </FeatureBoundary>
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
                <ChoiceField
                    label={m.metronome_groove()}
                    value={prefs.metronomeGroove}
                    onChange={(value) => update({ metronomeGroove: value as Groove })}
                    options={GROOVES.map((groove) => ({ id: groove, label: grooveLabel(groove) }))}
                />
                <SwitchField
                    label={m.metronome_adaptive()}
                    checked={prefs.metronomeAdaptive}
                    onChange={(metronomeAdaptive) => update({ metronomeAdaptive })}
                />
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
                title={m.settings_appearance()}
                hint={m.settings_appearance_hint()}
                icon={<SlidersIcon className={ICON} />}
            >
                <div className="flex items-center justify-between">
                    <span className="text-sm text-body">{m.settings_theme()}</span>
                    <FeatureBoundary feature="ThemeToggle">
                        <ThemeToggle />
                    </FeatureBoundary>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-sm text-body">{m.settings_language()}</span>
                    <FeatureBoundary feature="LanguageSwitcher">
                        <LanguageSwitcher />
                    </FeatureBoundary>
                </div>
                {/* The on-screen keyboard's colours are an appearance choice too, so
                they sit here rather than in a section of their own. */}
                <SettingsSection title={m.settings_keyboard_theme()} level={3}>
                    <FeatureBoundary feature="KeyboardThemePicker">
                        <KeyboardThemePicker />
                    </FeatureBoundary>
                </SettingsSection>
                {/* Colour and shading are two questions about one instrument, so the two
                choosers sit together — what the keys are made of, then what colour. */}
                <SettingsSection title={m.settings_keyboard_finish()} level={3}>
                    <FeatureBoundary feature="KeyboardFinishPicker">
                        <KeyboardFinishPicker />
                    </FeatureBoundary>
                </SettingsSection>
            </SettingsSection>

            <FeatureBoundary feature="ProgressBackup">
                <ProgressBackup />
            </FeatureBoundary>

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

            {/* Only present when something has actually gone wrong, so it sits above the
                danger zone rather than in it: reporting a fault is not destructive. */}
            <FeatureBoundary feature="RecentProblems">
                <RecentProblems />
            </FeatureBoundary>

            <FeatureBoundary feature="DangerZone">
                <DangerZone />
            </FeatureBoundary>
        </main>
    );
}
