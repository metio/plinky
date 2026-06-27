// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { loadDailyStreak } from "./dailyStreak";
import { loadHistory } from "./history";
import { loadAllMastery } from "./mastery";
import { loadPrefs } from "./prefs";

// The brand-new player's first steps, read from local state, so the grades page can
// guide a Grade-0 player toward their first grade rather than show an empty roadmap.
export type FirstSteps = {
    // Finished a run on any piece (mastery is recorded, or notes are logged).
    played: boolean;
    // Measured a hand span, which tailors the suggested fingering.
    handSet: boolean;
    // Completed at least one daily challenge.
    dailyDone: boolean;
};

export function firstSteps(): FirstSteps {
    const span = loadPrefs().handSpan;
    return {
        played:
            loadAllMastery().length > 0 || Object.values(loadHistory()).some((notes) => notes > 0),
        handSet: span.left !== null || span.right !== null,
        dailyDone: loadDailyStreak().last > 0,
    };
}

export function allFirstStepsDone(steps: FirstSteps): boolean {
    return steps.played && steps.handSet && steps.dailyDone;
}
