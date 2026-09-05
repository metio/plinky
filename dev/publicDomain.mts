// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { copyrightReason } from "./copyrightSignals.mts";

// An ALLOWLIST: a song is admitted to the catalogue only when we can affirmatively
// show its *composition* is public domain (the notes are copyrighted independently of
// any recording — sharing sheet music of a copyrighted song still infringes). Anything
// we cannot confirm is dropped. This is deliberately conservative: legitimate
// user-original CC0 works and public-domain composers we don't recognise are lost, but
// the trade is correct — a smaller, safe catalogue over a larger, risky one.
//
// "Safe" means one of:
//   - the composer field names a death year on or before the life+70 cutoff,
//   - the credit claims no author at all and the work is traditional / folk /
//     anonymous / a hymn or carol, or
//   - the composer is a well-known public-domain composer.
//
// And in every case the credit has to be an attribution rather than a filing category:
// "Misc Christmas" says nothing about who wrote the piece, so nothing here may read it.
//
// NOT legal advice; a backstop, not a guarantee. A single composition year is ignored
// (it doesn't tell us the author's death year); only a "(birth–death)" range counts.

// Works enter the public domain 70 years after the author's death (life+70), i.e. on
// 1 January of the 71st year. From 2026, a death in 1955 or earlier is clear.
const DEATH_CUTOFF = 1955;

import { personSlug } from "../core/person.ts";

// PDMX composer fields carry accents inconsistently ("Fauré" / "Faure", "Händel" /
// "Handel", "Dvořák" / "Dvorak"), so fold diacritics away before matching and write the
// patterns in their plain-ASCII form.
const fold = (value: string): string => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const TRADITIONAL =
    /\btrad\b|tradition|anonym|anonimo|\bfolk\b|spiritual|kinderlied|volkslied|\bhymn\b|\bcarol\b|nursery|children'?s song|public[ -]?domain|\bsacred\b|gregorian|plainchant|\bchant\b|shanty|wiegenlied|weihnacht|\bnoel\b/;

// Well-known public-domain composers (died > 70 years ago), matched as complete surnames
// (both word boundaries) so a stem never bleeds into an unrelated word: "bach" must not
// match "Bacharach" or a title's "bachelor", "clementi" must not match "clementine".
// Not exhaustive — the death range catches the rest where dates are given.
const PD_SURNAMES =
    /\b(bach|mozart|beethoven|chopin|schubert|brahms|haendel|handel|vivaldi|haydn|debussy|satie|grieg|schumann|liszt|rossini|mendelssohn|clementi|czerny|scarlatti|purcell|joplin|sousa|pachelbel|telemann|elgar|dvorak|verdi|wagner|bizet|saint-?saens|faure|albeniz|rimsky|borodin|burgmuller|gurlitt|kuhlau|diabelli|hanon|gounod|offenbach|paganini|carcassi|giuliani|tarrega|ravel|gershwin|mascagni|puccini|smetana|holst|nielsen|janacek|scriabin|macdowell|streabbog|spindler|reinecke|kirchner|lemoine|couppey|bertini|loeschhorn|duvernoy|kohler|wohlfahrt|schytte|heller|albinoni|corelli|couperin|rameau|lully|tartini|boccherini|cherubini|hummel|weber|paderewski|massenet|delibes|chaminade|moszkowski|sinding|sgambati|thalberg|moscheles|cramer|dowland|sullivan|carolan|frescobaldi|buxtehude|palestrina|monteverdi|praetorius|froberger|sweelinck|cimarosa|paisiello|gottschalk|rebikov|guilmant|widor|vierne|dandrieu|daquin|marcello|kjerulf|oesten|maykapar|sor|field|byrd|gade|raff|nevin|bartok|mahler|weill|gardel|butterworth|halvorsen|tagore|ponce|tosti|lavallee|reichardt|ravenscroft|leontovych|kinkel|faisst|lyapunov)\b/;
// Not listed because they are NOT public domain yet, whatever their place in the piano
// teaching repertoire: William Gillock died in 1993 and his catalogue is in copyright;
// Alexander Goedicke ("Gedike") died in 1957 and clears the life+70 rule on 1 January
// 2028, when DEATH_CUTOFF reaches 1957 — re-add "goedicke|gedike" then. A familiar name
// on a beginner's shelf is not the same thing as an expired copyright, and this list is
// read by the importer as proof.
// Deliberately NOT listed as a bare surname, despite the composer themselves being public
// domain: it would admit copyrighted namesakes or co-written works. "gonzaga" would match
// Luiz Gonzaga (d. 1989, e.g. "Asa Branca") alongside the PD Chiquinha Gonzaga; "waller"
// would admit Fats Waller's co-authored songs ("Ain't Misbehavin'", co-written by Harry
// Brooks, d. 1970) that his own 1943 death does not clear. "foster" would admit David
// Foster (b. 1949) and "adam" is far too common a token — both are instead matched by
// full name in PD_FULLNAMES. "granados" was on the bare list for Enrique Granados (d.
// 1916) and let in two works by namesakes: the Atlético de Madrid anthem, written in 1974
// by José Aguilar Granados and Ángel Currás, and a "Heart and soul" credited to a Sean
// Granados over a Hoagy Carmichael tune (d. 1981). Both were marked CC0 by whoever
// uploaded them, which is what the allowlist exists not to believe.

// Public-domain composers whose surname is too common — or collides with a copyrighted
// namesake — to admit on its own, so the full name is required. Stephen Foster (d. 1864)
// must not open the door to David Foster; Adolphe Adam (d. 1856) needs more than the bare
// token "adam".
//
// The second group was added when the traditional markers stopped reading titles. Every
// one of them wrote a hymn, a Wiegenlied or a Noël that had been admitted on the strength
// of that word rather than on their own name, and every one died long enough ago to
// qualify: Humfrey 1674, Ravenscroft 1635, Brady 1726, Reichardt 1826, Cornelius 1874,
// Flies (18th c.), Holden 1844, Ingalls 1838, Leontovych 1921, Kinkel 1858, Holmès 1903,
// Le Beau 1927, Hill 1915, Faisst 1948, Parry 1918, Gabriel 1877, Lyapunov 1924, Lang
// 1880, Franz 1892. Most needed the full name — "hill", "gabriel", "lang", "franz",
// "holden", "brady", "cornelius" and "parry" are all ordinary modern surnames, and
// "flies" is an ordinary English word.
const PD_FULLNAMES =
    /\b(stephen foster|adolphe adam|enrique granados|pelham humfrey|nicholas brady|peter cornelius|bernhard flies|oliver holden|jeremiah ingalls|joe hill|charles hubert hastings parry|virginia gabriel|josephine lang|robert franz|luise adolpha le beau|augusta (mary anne )?holmes)\b/;

// A handful of composers whose PDMX field truncates or continues the surname
// ("Tchaikovsky", "Rachmaninoff", "Mussorgsky"): match the stem with a trailing \w* so a
// suffixed form still matches. Distinctive enough that a false positive is implausible.
const PD_STEMS = /\b(tchaikov|tschaikow|rachmanin|mussorg|moussorg)\w*/;

// True when the composition is confidently public domain. Composer-name patterns read
// ONLY the composer field (a title word like "bachelor" must never admit a song); the
// traditional/anonymous markers may land in either field, so those read both.
// Works the corpora mislabel "Traditional" that are in fact 20th-century and
// still under copyright — the label admits them through the traditional rule,
// so they are denied by title first. Petit Papa Noël is Henri Martinet (d.
// 1985), You Are My Sunshine is Davis/Mitchell (published 1940), Tzena Tzena
// is Issachar Miron (published 1941).
const COPYRIGHTED_WORKS = /\b(petit papa noel|you are my sunshine|tzena)\b/;

// Music written for a screen is modern by definition — there were no soundtracks before
// there were films — so a credit or a title announcing one is announcing a work still in
// copyright, whoever the uploader named. The corpora label these with a placeholder
// composer ("Misc Soundtrack") that claims no author, which every other rule here reads
// as anonymity; it is the opposite. "theme" alone is not a marker: a theme and variations
// is a form, not a film.
const SCREEN_MUSIC = /\bsoundtrack\b|\bost\b|\bvideo\s?game\b|\banime\b/;

// "Misc Christmas", "Misc Traditional", "Misc Soundtrack" — the corpora's own filing
// buckets, sitting in the field that is supposed to say who wrote the piece. It is not an
// attribution and it is not a claim of anonymity either; it is the absence of both, and
// every rule here that reads it does so wrongly. "Misc Soundtrack" read as nobody claiming
// the work when it meant a television theme; "Misc Christmas" carried two carols in on a
// word in their titles. A credit that names a category rather than a person tells us
// nothing, and nothing is not enough.
const CATEGORY_NOT_A_COMPOSER = /^misc\b/;

export function isPublicDomain(composer: string, title = ""): boolean {
    if (composer.trim() === "") {
        return false; // no attribution — can't confirm anything
    }
    if (
        COPYRIGHTED_WORKS.test(fold(title)) ||
        SCREEN_MUSIC.test(fold(`${composer} ${title}`)) ||
        CATEGORY_NOT_A_COMPOSER.test(fold(composer))
    ) {
        return false;
    }
    // A traditional marker in the COMPOSER field is an attribution: whoever uploaded it is
    // telling us nobody claims the work.
    if (TRADITIONAL.test(fold(composer))) {
        return true;
    }
    // In a TITLE the same word says nothing about authorship — it is a word about the
    // music, and copyrighted music has words about music in its name. Reading both fields
    // as one string admitted five works still in copyright on the strength of a title:
    // Animal Crossing: City *Folk*, a 2019 song called "Oh *Noel*", a *Weihnacht*slied
    // written in 1987, and the Cowboy Bebop theme, "The Real *Folk* Blues".
    //
    // So a title marker only corroborates a credit that names nobody. core/person.ts
    // already decides that question — it is what stops "Traditional" getting a composer
    // page — and its answer is the one to use here: a credit it will not give a page to is
    // a credit claiming no author, which is exactly when "Coventry carol" should count.
    if (TRADITIONAL.test(fold(title)) && personSlug(composer) === "") {
        return true;
    }
    // A "(birth–death)" range: the second year is the death year.
    const range = composer.match(/\b1[0-9]\d\d\s*[-–—]\s*(1[0-9]\d\d)\b/);
    if (range && Number(range[1]) <= DEATH_CUTOFF) {
        return true;
    }
    const name = fold(composer);
    return PD_SURNAMES.test(name) || PD_FULLNAMES.test(name) || PD_STEMS.test(name);
}

// Whether a credit may enter the catalogue: a public-domain attribution with no
// copyrighted-artist signal in it. Asked of every name that is about to be written, not
// only of the one the source's index offered — a file's own creator line is what the
// catalogue credits, and it need not agree with the index.
export function creditAllowed(composer: string, title = ""): boolean {
    return isPublicDomain(composer, title) && copyrightReason(composer) === null;
}
