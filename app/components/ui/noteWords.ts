// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { NoteWords } from "../../../core/noteNaming";
import { m } from "../../paraglide/messages.js";
import { getLocale, type Locale } from "../../paraglide/runtime.js";

// The translated words a note's name is built from, in the given language: the seven
// solfège syllables, and how a sentence and a voice say a raised or lowered note. Beside
// the keyboard because the keyboard is the first thing that names a note, and it may not
// reach up into the app. One set per language, since every note named reads it.
const WORDS = new Map<Locale, NoteWords>();

export function noteWords(locale: Locale = getLocale()): NoteWords {
    let words = WORDS.get(locale);
    if (words === undefined) {
        words = wordsIn(locale);
        WORDS.set(locale, words);
    }
    return words;
}

function wordsIn(locale: Locale): NoteWords {
    const options = { locale };
    return {
        syllables: [
            m.solfege_do({}, options),
            m.solfege_re({}, options),
            m.solfege_mi({}, options),
            m.solfege_fa({}, options),
            m.solfege_sol({}, options),
            m.solfege_la({}, options),
            m.solfege_si({}, options),
        ],
        sharp: (note) => m.note_sharp_word({ note }, options),
        flat: (note) => m.note_flat_word({ note }, options),
        spokenSharp: (note) => m.keyboard_key_sharp({ note }, options),
    };
}
