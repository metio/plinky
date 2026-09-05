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
                    {exerciseName(warmUp.exercise)} →
                </Link>
            </div>
        </SettingsSection>
    );
}
