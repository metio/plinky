// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { GlossaryCategory } from "../../core/glossary";
import { m } from "../paraglide/messages.js";

// What each symbol is called and what it asks of you. core owns which marks exist and
// how they sound; the words for them live here, so the index and the entry itself can
// never disagree about what a symbol is called.
//
// Names are the real musical terms — most of them Italian, and the same word in most
// languages — because a reader who meets `staccato` in a score should recognise the
// word they learned it by.

export const SYMBOL_NAMES: Record<string, () => string> = {
    dotted: m.glossary_dotted_name,
    tie: m.glossary_tie_name,
    rest: m.glossary_rest_name,
    staccato: m.glossary_staccato_name,
    accent: m.glossary_accent_name,
    slur: m.glossary_slur_name,
    piano: m.glossary_piano_name,
    forte: m.glossary_forte_name,
    keySignature: m.glossary_key_signature_name,
    accidental: m.glossary_accidental_name,
    timeSignature: m.glossary_time_signature_name,
    bassClef: m.glossary_bass_clef_name,
};

export const SYMBOL_GLOSSES: Record<string, () => string> = {
    dotted: m.glossary_dotted_gloss,
    tie: m.glossary_tie_gloss,
    rest: m.glossary_rest_gloss,
    staccato: m.glossary_staccato_gloss,
    accent: m.glossary_accent_gloss,
    slur: m.glossary_slur_gloss,
    piano: m.glossary_piano_gloss,
    forte: m.glossary_forte_gloss,
    keySignature: m.glossary_key_signature_gloss,
    accidental: m.glossary_accidental_gloss,
    timeSignature: m.glossary_time_signature_gloss,
    bassClef: m.glossary_bass_clef_gloss,
};

// The four questions a mark can answer. The grouping is the first thing a reader sees,
// so it says what kind of instruction they are looking at before they read a word of it.
export const CATEGORY_NAMES: Record<GlossaryCategory, () => string> = {
    length: m.glossary_category_length,
    touch: m.glossary_category_touch,
    loudness: m.glossary_category_loudness,
    place: m.glossary_category_place,
};

export function symbolName(id: string): string {
    return SYMBOL_NAMES[id]?.() ?? id;
}

export function symbolGloss(id: string): string {
    return SYMBOL_GLOSSES[id]?.() ?? "";
}
