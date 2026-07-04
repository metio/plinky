// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The review-scheduling knobs of the progression model. They live in core because
// both the preference model and the grade ladder speak in these terms.

// How a grade decays when its pieces go unreviewed: gentle counts everything learned
// and only dulls its shine, competitive stops counting a lapsed piece until it is
// refreshed — the opt-in challenge. Never destructive either way.
export type DecayMode = "gentle" | "competitive";

// The most refresh reviews to surface in a day, so maintenance never piles up.
export const REVIEW_CAP = 8;
