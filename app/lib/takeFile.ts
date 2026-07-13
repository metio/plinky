// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Take } from "../../core/takes";
import { fileStem } from "./printScore";

function pad(value: number): string {
    return String(value).padStart(2, "0");
}

// A download name that identifies the take rather than colliding: the piece, the grade it
// earned, and when it was saved (local date and time to the minute). So several takes of
// one piece land as distinct, meaningful files — "twinkle…-S-2026-07-13-2009.mid" — instead
// of one "twinkle…-take.mid" the browser has to disambiguate with "(1)". An ungraded take
// (a partial run) keeps the plain "take" label in place of a letter.
export function takeFileStem(title: string, take: Take): string {
    const saved = new Date(take.createdAt);
    const stamp = `${saved.getFullYear()}-${pad(saved.getMonth() + 1)}-${pad(saved.getDate())}-${pad(saved.getHours())}${pad(saved.getMinutes())}`;
    return `${fileStem(title)}-${take.letter || "take"}-${stamp}`;
}
