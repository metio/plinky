// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Dispatch, SetStateAction } from "react";
import { type Beams, BEAMS } from "../../../core/beams";
import type { Hand } from "../../../core/matcher";
import { BARS_PER_ROW, NOTE_SCALES, REVEAL_TRIES } from "../../../core/prefs";
import { STUDY_SECONDS, type StudySeconds } from "../../../core/sightRead";
import { m } from "../../paraglide/messages.js";
import { Bpm } from "../ui/bpm";
import { IconButton } from "../ui/button";
import { Disclosure } from "../ui/disclosure";
import { ChoiceField, SwitchField } from "../ui/fields";
import { BookIcon, EyeIcon, GradCapIcon, RotateIcon, SlidersIcon, StarIcon } from "../ui/icons";
import { ScoreSymbols } from "./scoreSymbols";
import { levelOf } from "../../../core/readingLevel";
import { usePrefs } from "../../hooks/usePrefs";
import { SettingsSection } from "../ui/settingsSection";
import { Stepper } from "../ui/stepper";
import { ReadingLevel } from "./readingLevel";
import { usePlaySession } from "./playSession";
import { Show } from "./conditional";

const ICON = "h-5 w-5";

const handLabel: Record<Hand, string> = {
    both: m.hand_both(),
    right: m.hand_right(),
    left: m.hand_left(),
};

const beamsLabel: Record<Beams, string> = {
    auto: m.beams_auto(),
    on: m.beams_on(),
    off: m.beams_off(),
};

// What shapes the run you are about to play. Changing any of it mid-piece would mean
// starting over, so it lives before the run rather than in the mid-play controls, and it
// reads as the Settings page does — each theme in its own titled, icon-led card.
//
// What is about THIS PIECE is on the page: how you play it, and the challenges you can
// put on it. What is about every piece — the skill level, the reading aids, the score
// layout — folds away, because Settings owns it too and a reader loses nothing by
// opening it there instead.

function RunSetupPanel() {
    const {
        lockTempo,
        staffCount,
        hand,
        setHand,
        matcher,
        enforceTempo,
        setEnforceTempo,
        guideNotes,
        setGuideNotes,
        duet,
        setDuet,
        transpose,
        setTranspose,
        hiddenNotes,
        setHiddenNotes,
        revealTries,
        setRevealTries,
        trainerOn,
        setTrainerOn,
        trainerTarget,
        setTrainerTarget,
        raceGhost,
        setRaceGhost,
        ready,
        measureCount,
        loop,
        hasSaved,
        showMine,
        setShowMine,
        metronomeOn,
        setMetronomeOn,
        forgiving,
        setForgiving,
        reading,
        sightRead,
        sightReadRecord,
        focusLoop,
        setFocusLoop,
        xml,
    } = usePlaySession();
    // Derived from the aid prefs, never stored — the same single source of truth the
    // skill-level control reads, so the panel can never disagree with the picker above it.
    const { prefs } = usePrefs();
    const starter = levelOf(prefs) === "starter";

    return (
        <div className="space-y-4">
            {starter && (
                // The space the folded controls free up says the one thing a beginner
                // actually needs to hear before a first run.
                <p className="text-sm text-muted">{m.run_starter_hint()}</p>
            )}

            <SettingsSection
                title={m.run_group_practice_title()}
                hint={m.run_group_practice_hint()}
                icon={<SlidersIcon className={ICON} />}
            >
                {staffCount >= 2 && (
                    <ChoiceField
                        label={m.hand_label()}
                        value={hand}
                        onChange={setHand}
                        options={(["both", "right", "left"] as const).map((option) => ({
                            id: option,
                            label: handLabel[option],
                        }))}
                        help={m.hand_caption()}
                        disabled={matcher.practicing}
                    />
                )}
                {/* One control for the pace, where there used to be two writing the
                    same state from opposite ends of the same open panel: this switch
                    and the sight-read tempo choice below it. */}
                <ChoiceField
                    label={m.run_pace_label()}
                    value={enforceTempo ? "tempo" : "own"}
                    onChange={(value: string) => setEnforceTempo(value === "tempo")}
                    options={[
                        { id: "own", label: m.sight_read_tempo_own() },
                        { id: "tempo", label: m.keep_up_toggle() },
                    ]}
                    help={m.keep_up_hint()}
                />
                {enforceTempo && (
                    <SwitchField
                        label={m.guide_notes_toggle()}
                        checked={guideNotes}
                        onChange={setGuideNotes}
                        help={m.guide_notes_hint()}
                    />
                )}
                {/* A duet needs one hand sitting out for the app to play — in keep-up it
            follows the clock, self-paced it follows your own pace note by note. */}
                {staffCount >= 2 && hand !== "both" && (
                    <SwitchField
                        label={m.duet_toggle()}
                        checked={duet}
                        onChange={setDuet}
                        help={m.duet_hint()}
                    />
                )}
                {/* Sight-read reads at the top rung for one run: no colours, no highway,
                    no second try at a missed note. The switches showed the saved values
                    while the run ignored them; they read as unavailable now, and what
                    they show is what this run will actually do. */}
                <SwitchField
                    label={m.forgiving_toggle()}
                    checked={sightRead.on ? false : forgiving}
                    onChange={setForgiving}
                    help={m.forgiving_hint()}
                    disabled={sightRead.on}
                />
                <SwitchField
                    label={m.action_metronome()}
                    checked={metronomeOn}
                    onChange={setMetronomeOn}
                    help={m.metronome_toggle_hint()}
                />
            </SettingsSection>

            <SettingsSection
                title={m.run_group_challenge_title()}
                hint={m.run_group_challenge_hint()}
                icon={<StarIcon className={ICON} />}
            >
                <SwitchField
                    label={m.sight_read()}
                    checked={sightRead.on}
                    onChange={sightRead.setOn}
                    help={m.sight_read_caption()}
                />
                {sightRead.on && (
                    <>
                        <ChoiceField
                            label={m.sight_read_study()}
                            value={String(sightRead.studySeconds)}
                            onChange={(value: string) =>
                                sightRead.setStudySeconds(Number(value) as StudySeconds)
                            }
                            options={STUDY_SECONDS.map((seconds) => ({
                                id: String(seconds),
                                label: m.sight_read_study_seconds({ seconds }),
                            }))}
                            help={m.sight_read_study_caption()}
                        />
                        {!enforceTempo && (
                            <SwitchField
                                label={m.sight_read_vanish()}
                                checked={sightRead.vanish}
                                onChange={sightRead.setVanish}
                                help={m.sight_read_vanish_caption()}
                            />
                        )}
                        {sightReadRecord && (
                            <p className="text-sm text-muted">
                                {m.sight_read_already({
                                    letter: sightReadRecord.letter,
                                    score: sightReadRecord.score,
                                })}
                            </p>
                        )}
                    </>
                )}
                {!lockTempo && <TransposeRow transpose={transpose} setTranspose={setTranspose} />}
                {!lockTempo && (
                    <SwitchField
                        label={m.tempo_trainer()}
                        checked={trainerOn}
                        onChange={setTrainerOn}
                        help={m.tempo_trainer_caption()}
                    />
                )}
                {!lockTempo && trainerOn && (
                    <div className="space-y-1">
                        <label className="flex items-center gap-2 text-sm text-body">
                            <span>{m.tempo_trainer_target()}</span>
                            <input
                                type="range"
                                min={40}
                                max={180}
                                value={trainerTarget}
                                onChange={(event) => setTrainerTarget(Number(event.target.value))}
                                aria-label={m.tempo_trainer_target()}
                            />
                            <Bpm tempo={trainerTarget} term />
                        </label>
                        <p className="text-xs text-muted">{m.tempo_trainer_target_caption()}</p>
                    </div>
                )}
                <SwitchField
                    label={m.race_ghost_toggle()}
                    checked={raceGhost}
                    onChange={setRaceGhost}
                    help={m.race_ghost_hint()}
                />
                {ready && measureCount > 1 && (
                    <SwitchField
                        label={m.loop_section()}
                        checked={loop.on}
                        onChange={loop.toggle}
                        help={m.loop_caption()}
                    />
                )}
                {/* Only offered with a loop set: "just these bars" needs bars to mean. */}
                {ready && measureCount > 1 && loop.on && (
                    <SwitchField
                        label={m.focus_loop()}
                        checked={focusLoop}
                        onChange={setFocusLoop}
                        help={m.focus_loop_caption()}
                    />
                )}
            </SettingsSection>

            {/* The one fold that is left, and everything in it is a second door onto
                Settings → Reading — so folding it hides nothing a reader cannot reach
                anyway, and the two cards above, which are about this piece and no other,
                are on the page where they are chosen. */}
            <Disclosure summary={m.run_group_sheet_title()}>
                <div className="space-y-4">
                    <SettingsSection
                        title={m.run_group_skill_title()}
                        hint={m.run_group_skill_hint()}
                        icon={<GradCapIcon className={ICON} />}
                    >
                        {/* A sight-read run reads at the top rung whatever is chosen here,
                            so the picker would be showing a level this run is not using. */}
                        <Show when={!sightRead.on}>
                            <ReadingLevel labelled={false} />
                        </Show>
                        <Show when={sightRead.on}>
                            <p className="text-sm text-muted">{m.sight_read_aids_note()}</p>
                        </Show>
                    </SettingsSection>

                    <ScoreSymbols xml={xml} />

                    <SettingsSection
                        title={m.run_group_reading_title()}
                        hint={m.run_group_reading_hint()}
                        icon={<EyeIcon className={ICON} />}
                    >
                        {/* Keep up drives the cursor on the beat, which leaves no room to
                            hunt for a note nobody can see — the run forces the noteheads
                            back on. The switch used to sit here on and ignored; it reads as
                            unavailable now, and what it shows is what this run will do
                            rather than what the preference says. */}
                        <SwitchField
                            label={m.hidden_notes_toggle()}
                            checked={enforceTempo || sightRead.on ? false : hiddenNotes}
                            onChange={setHiddenNotes}
                            help={m.hidden_notes_hint()}
                            disabled={enforceTempo || sightRead.on}
                        />
                        {hiddenNotes && !enforceTempo && (
                            <ChoiceField
                                label={m.reveal_tries()}
                                value={String(revealTries)}
                                onChange={(id) => setRevealTries(Number(id))}
                                options={REVEAL_TRIES.map((n) => ({
                                    id: String(n),
                                    label: String(n),
                                }))}
                                help={m.reveal_tries_caption()}
                            />
                        )}
                        <SwitchField
                            label={m.color_notes_toggle()}
                            checked={sightRead.on ? false : reading.colorNotes}
                            onChange={reading.setColorNotes}
                            help={m.color_notes_hint()}
                            disabled={sightRead.on}
                        />
                        <SwitchField
                            label={m.highway_toggle()}
                            checked={sightRead.on ? false : reading.highway}
                            onChange={reading.setHighway}
                            help={m.highway_hint()}
                            disabled={sightRead.on}
                        />
                        <SwitchField
                            label={m.action_finger_numbers()}
                            checked={reading.showFingerings}
                            onChange={(on) => reading.setShowFingerings(on)}
                            help={m.finger_numbers_hint()}
                        />
                        {hasSaved && reading.showFingerings && (
                            <SwitchField
                                label={m.fingering_show_mine()}
                                checked={showMine}
                                onChange={setShowMine}
                                help={m.fingering_show_mine_caption()}
                            />
                        )}
                    </SettingsSection>

                    <SettingsSection
                        title={m.run_group_layout_title()}
                        hint={m.run_group_layout_hint()}
                        icon={<BookIcon className={ICON} />}
                    >
                        {/* Follow drives its own scrolling in both layouts; the treadmill
                    already scrolls under a fixed gaze, so the toggle is moot there. */}
                        {!reading.treadmill && (
                            <SwitchField
                                label={m.action_scroll_follow()}
                                checked={reading.scrollFollow}
                                onChange={(on) => reading.setScrollFollow(on)}
                                help={m.scroll_follow_hint()}
                            />
                        )}
                        <SwitchField
                            label={m.treadmill_toggle()}
                            checked={reading.treadmill}
                            onChange={reading.setTreadmill}
                            help={m.treadmill_hint()}
                        />
                        {!reading.treadmill && (
                            <ChoiceField
                                label={m.bars_per_row()}
                                value={String(reading.barsPerRow)}
                                onChange={(id) => reading.setBarsPerRow(Number(id))}
                                options={BARS_PER_ROW.map((n) => ({
                                    id: String(n),
                                    label: n === 0 ? m.bars_per_row_auto() : String(n),
                                }))}
                                help={m.bars_per_row_caption()}
                            />
                        )}
                        <SwitchField
                            label={m.bar_numbers_toggle()}
                            checked={reading.barNumbers}
                            onChange={reading.setBarNumbers}
                            help={m.bar_numbers_hint()}
                        />
                        <ChoiceField
                            label={m.beams_label()}
                            value={reading.beams}
                            onChange={(id) => reading.setBeams(id as Beams)}
                            options={BEAMS.map((option) => ({
                                id: option,
                                label: beamsLabel[option],
                            }))}
                            help={m.beams_caption()}
                        />
                        <ChoiceField
                            label={m.note_size_label()}
                            value={String(reading.noteScale)}
                            onChange={(id) => reading.setNoteScale(Number(id))}
                            options={NOTE_SCALES.map((scale) => ({
                                id: String(scale),
                                label: `${Math.round(scale * 100)}%`,
                            }))}
                            help={m.note_size_caption()}
                        />
                    </SettingsSection>
                </div>
            </Disclosure>
        </div>
    );
}

// The piece's own controls, on the piece's page.
export function RunSetup() {
    return <RunSetupPanel />;
}

// Transposition shifts the whole piece into a friendlier key before the run.
function TransposeRow({
    transpose,
    setTranspose,
}: {
    transpose: number;
    setTranspose: Dispatch<SetStateAction<number>>;
}) {
    return (
        <div className="space-y-1">
            <span className="flex items-center gap-2 text-sm text-body">
                <span>{m.transpose()}</span>
                <Stepper
                    value={m.transpose_semitones({
                        count:
                            transpose > 0
                                ? `+${transpose}`
                                : transpose < 0
                                  ? `−${-transpose}`
                                  : "0",
                    })}
                    decrementLabel={m.transpose_down()}
                    incrementLabel={m.transpose_up()}
                    canDecrement={transpose > -12}
                    canIncrement={transpose < 12}
                    onDecrement={() => setTranspose((value) => Math.max(value - 1, -12))}
                    onIncrement={() => setTranspose((value) => Math.min(value + 1, 12))}
                />
                {transpose !== 0 && (
                    <IconButton
                        variant="ghost"
                        label={m.transpose_reset()}
                        onClick={() => setTranspose(0)}
                    >
                        <RotateIcon className="h-5 w-5" />
                    </IconButton>
                )}
            </span>
            <p className="text-xs text-muted">{m.transpose_caption()}</p>
        </div>
    );
}
