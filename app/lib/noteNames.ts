// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
    minorKeyTextIn,
    type Naming,
    namingFor,
    noteSymbolIn,
    noteTextIn,
    octaveOf,
    openingIn,
} from "../../core/noteNaming";
import type { Prefs } from "../../core/prefs";
import { type NoteNameId, noteNameOf, type Spelling } from "../../core/theory";
import { noteWords } from "../components/ui/noteWords";
import { getLocale } from "../paraglide/runtime.js";

// Note names as this reader reads them. core/noteNaming decides the system from the
// player's key labels and the page's language; the words come from the translations.

// The naming a set of preferences asks for, on this page.
export function namingOf(prefs: Pick<Prefs, "noteLabels" | "noteLetters">): Naming {
    return namingFor(prefs.noteLabels, getLocale(), prefs.noteLetters);
}

// The naming of a device that has chosen nothing: what a surface shown with no player
// behind it — a story, an isolated test — says.
export function localNaming(): Naming {
    return namingFor("auto", getLocale());
}

// A note in a sentence: C♯, Cis, "ré dièse".
export function noteText(name: NoteNameId | string, naming: Naming): string {
    return noteTextIn(name, naming.system, noteWords());
}

// A note as a label or a chord symbol writes it: C♯, Cis, ré♯.
export function noteSymbol(name: NoteNameId | string, naming: Naming): string {
    return noteSymbolIn(name, naming.system, noteWords());
}

// A pitch, any octave, named in a sentence or as a label. Spelled on sharps unless a key
// signature asks for flats: the key of D flat contains no C sharp.
export function pitchText(pitch: number, naming: Naming, spelling: Spelling = "sharp"): string {
    return noteText(noteNameOf(pitch, spelling), naming);
}

export function pitchSymbol(pitch: number, naming: Naming, spelling: Spelling = "sharp"): string {
    return noteSymbol(noteNameOf(pitch, spelling), naming);
}

// A key with its octave, as a readout prints it: C4, Ais4, la♯4.
export function pitchName(pitch: number, naming: Naming): string {
    return `${pitchSymbol(pitch, naming)}${octaveOf(pitch)}`;
}

// The tonic of a minor key, lower case where the language writes it so.
export function minorKeyText(name: NoteNameId | string, naming: Naming): string {
    return minorKeyTextIn(name, naming, noteWords());
}

// A line that may open on a note's name, capitalised as a first word is.
export function opening(text: string, naming: Naming): string {
    return openingIn(text, naming.system, getLocale());
}
