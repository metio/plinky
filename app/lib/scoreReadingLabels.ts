// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ScoreReading } from "../../core/grade";
import { m } from "../paraglide/messages.js";

// What each reading is called, and what it means, in the player's own language.
//
// Core decides which readings a run has and in what order; this is the half that needs the
// message catalogue, which core cannot have. Both places that show readings — the panel at
// the end of a run and the list of saved takes — read the names from here, so a reworded
// label lands in both.
export const readingLabel: Record<ScoreReading, () => string> = {
    accuracy: m.scores_accuracy,
    timing: m.scores_timing,
    flow: m.scores_flow,
    dynamics: m.scores_dynamics,
    expression: m.scores_expression,
};

export const readingExplanation: Record<ScoreReading, () => string> = {
    accuracy: m.scores_explain_accuracy,
    timing: m.scores_explain_timing,
    flow: m.scores_explain_flow,
    dynamics: m.scores_explain_dynamics,
    expression: m.scores_explain_expression,
};
