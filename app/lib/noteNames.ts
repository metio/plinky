// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { minorKeyTextIn, type NoteSystem, noteSystemFor, noteTextIn } from "../../core/noteNaming";
import type { NoteNameId } from "../../core/theory";
import { getLocale } from "../paraglide/runtime.js";

// Note names as the reader's language writes them. core/noteNaming knows the systems; the
// page's locale picks one, so a German page reads H where an English one reads B.

export function localNoteSystem(): NoteSystem {
    return noteSystemFor(getLocale());
}

export function noteText(name: NoteNameId): string {
    return noteTextIn(name, localNoteSystem());
}

export function minorKeyText(name: NoteNameId): string {
    return minorKeyTextIn(name, localNoteSystem());
}
