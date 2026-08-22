// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One thing to learn, offered beside the day's practice. A reference nobody knows to
// open teaches nobody: the theory course, the glossary, the practice methods and the
// tools all exist and all wait to be gone looking for, so the day names one of them.
//
// Deterministic — the pick comes from the day's number rather than a die, so it holds
// still while you look at it and moves on tomorrow.

export type LearnPickId = "basics" | "placement" | "theory" | "glossary" | "methods" | "tools";

// The four that rotate once the two one-off steps are behind you. Order is the order
// they help in: how the music is built, what a mark means, how to practise it, and the
// bench you reach for mid-practice.
const ROTATION: readonly LearnPickId[] = ["theory", "glossary", "methods", "tools"];

export type LearnPickState = {
    // Whether the keyboard tour has been finished.
    keyboardMet: boolean;
    // Whether a placement test has ever been completed.
    placementTaken: boolean;
    // Whether every lesson of the theory course has been met. A finished course is a
    // dead offer, so it drops out of the rotation rather than coming round again.
    courseDone: boolean;
    // The day's number (the daily challenge's), so the rotation advances once a day.
    day: number;
};

// Someone who has never found middle C is offered that before anything else, and the
// level test comes next — both are one-off, so each drops out once it is done and the
// rotation takes over for good.
export function learnPick({
    keyboardMet,
    placementTaken,
    courseDone,
    day,
}: LearnPickState): LearnPickId {
    if (!keyboardMet) {
        return "basics";
    }
    if (!placementTaken) {
        return "placement";
    }
    const rotation = courseDone ? ROTATION.filter((id) => id !== "theory") : ROTATION;
    // Negative or fractional days would land off the end; the modulo is taken on a
    // whole, non-negative number so the pick is always one of the rotation.
    const index = Math.abs(Math.trunc(day)) % rotation.length;
    return rotation[index] as LearnPickId;
}

export const LEARN_PICK_HREF: Record<LearnPickId, string> = {
    basics: "/basics",
    placement: "/placement",
    theory: "/theory",
    glossary: "/glossary",
    methods: "/methods",
    tools: "/tools",
};
