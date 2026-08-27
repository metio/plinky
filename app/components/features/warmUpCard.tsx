// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { buildExerciseId, parseExerciseId } from "../../../core/exerciseGen";
import { warmUpFor } from "../../../core/warmUp";
import { exerciseName } from "../../lib/exerciseNames";
import { m } from "../../paraglide/messages.js";
import { SettingsSection } from "../ui/settingsSection";
import { NotesIcon } from "../ui/icons";
import { LocalizedLink as Link } from "../ui/localizedLink";
import { usePlayPiece } from "./playSession";

// The scale this piece is built from, offered under the score before you play it.
//
// The oldest piece of piano teaching there is — the skill alone, then the same skill in
// real music, minutes apart — and the thing the course apps use to make their lessons
// stick. What lets Plinky do it honestly is that the key is READ rather than guessed: the
// score is parsed on the way in, so the offer knows which black keys this piece will ask
// for instead of inferring them from an eight-note opening.
//
// It says which notes rather than which key. A signature's major scale and its relative
// minor hold exactly the same seven notes, so the same scale prepares a piece in either —
// and barely one score in twenty says which mode it is in, so claiming the key would be a
// guess where naming the accidentals is a fact.
//
// An offer, never a requirement: nothing is gated behind it and skipping it costs nothing.
// The exercise the offer points at: a one-octave major scale in the key it names. Built
// here so the card can hand it to the localised namer, which knows both the language and
// the note system the reader uses.
function warmUpExercise(key: string) {
    return {
        type: "major-scale",
        key,
        octaves: 1,
        hands: "both",
        inversion: 0,
        interval: "single",
    } as const;
}

export function WarmUpCard() {
    const { fifths, id, title } = usePlayPiece();
    const warmUp = warmUpFor({
        fifths,
        // Not read from the score: see above. The scale is right either way.
        minor: false,
        // A scale before a scale is a loop rather than a lesson.
        isExercise: parseExerciseId(id) !== null,
    });
    if (!warmUp) {
        return null;
    }
    // The piece travels with the drill so the drill can hand it back. A link that ends the
    // session in a side room is the difference between a warm-up and a detour.
    const to = `/play/${buildExerciseId(warmUp.exercise)}?then=${encodeURIComponent(id)}&fromTitle=${encodeURIComponent(title)}`;
    return (
        <SettingsSection
            title={m.warmup_card_title()}
            hint={m.warmup_card_hint()}
            icon={<NotesIcon className="h-5 w-5" />}
        >
            <div className="space-y-2">
                <p className="text-sm text-body">
                    {warmUp.accidentals.length > 0
                        ? m.warmup_card_notes({ notes: warmUp.accidentals.join(", ") })
                        : m.warmup_card_white()}
                </p>
                <Link
                    to={to}
                    className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-accent-strong hover:underline"
                >
                    {exerciseName(warmUpExercise(warmUp.key))} →
                </Link>
            </div>
        </SettingsSection>
    );
}
