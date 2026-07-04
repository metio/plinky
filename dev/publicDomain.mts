// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// An ALLOWLIST: a song is admitted to the catalogue only when we can affirmatively
// show its *composition* is public domain (the notes are copyrighted independently of
// any recording — sharing sheet music of a copyrighted song still infringes). Anything
// we cannot confirm is dropped. This is deliberately conservative: legitimate
// user-original CC0 works and public-domain composers we don't recognise are lost, but
// the trade is correct — a smaller, safe catalogue over a larger, risky one.
//
// "Safe" means one of:
//   - the composer field names a death year on or before the life+70 cutoff,
//   - the work is traditional / folk / anonymous / a hymn or carol, or
//   - the composer is a well-known public-domain composer.
//
// NOT legal advice; a backstop, not a guarantee. A single composition year is ignored
// (it doesn't tell us the author's death year); only a "(birth–death)" range counts.

// Works enter the public domain 70 years after the author's death (life+70), i.e. on
// 1 January of the 71st year. From 2026, a death in 1955 or earlier is clear.
const DEATH_CUTOFF = 1955;

// PDMX composer fields carry accents inconsistently ("Fauré" / "Faure", "Händel" /
// "Handel", "Dvořák" / "Dvorak"), so fold diacritics away before matching and write the
// patterns in their plain-ASCII form.
const fold = (value: string): string =>
    value
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();

const TRADITIONAL =
    /\btrad\b|tradition|anonym|anonimo|\bfolk\b|spiritual|kinderlied|volkslied|\bhymn\b|\bcarol\b|nursery|children'?s song|public[ -]?domain|\bsacred\b|gregorian|plainchant|\bchant\b|shanty|wiegenlied|weihnacht|\bnoel\b/;

// Well-known public-domain composers (died > 70 years ago), matched as complete surnames
// (both word boundaries) so a stem never bleeds into an unrelated word: "bach" must not
// match "Bacharach" or a title's "bachelor", "clementi" must not match "clementine".
// Not exhaustive — the death range catches the rest where dates are given.
const PD_SURNAMES =
    /\b(bach|mozart|beethoven|chopin|schubert|brahms|haendel|handel|vivaldi|haydn|debussy|satie|grieg|schumann|liszt|rossini|mendelssohn|clementi|czerny|scarlatti|purcell|joplin|sousa|pachelbel|telemann|elgar|dvorak|verdi|wagner|bizet|saint-?saens|faure|albeniz|granados|rimsky|borodin|burgmuller|gurlitt|kuhlau|diabelli|hanon|gounod|offenbach|paganini|carcassi|giuliani|tarrega|ravel|gershwin|mascagni|puccini|smetana|holst|nielsen|janacek|scriabin|macdowell|streabbog|spindler|reinecke|kirchner|lemoine|couppey|bertini|loeschhorn|duvernoy|kohler|wohlfahrt|schytte|gillock|heller|albinoni|corelli|couperin|rameau|lully|tartini|boccherini|cherubini|hummel|weber|paderewski|massenet|delibes|chaminade|moszkowski|sinding|sgambati|thalberg|moscheles|cramer|dowland|sullivan|carolan|frescobaldi|buxtehude|palestrina|monteverdi|praetorius|froberger|sweelinck|cimarosa|paisiello|gottschalk|rebikov|guilmant|widor|vierne|dandrieu|daquin|marcello|kjerulf|oesten|goedicke|gedike|maykapar|sor|field|byrd|gade|raff|nevin|bartok|mahler|weill|gardel|butterworth|halvorsen|tagore)\b/;
// Deliberately NOT listed, despite the composer themselves being public domain: a bare
// surname would admit copyrighted namesakes or co-written works. "gonzaga" would match
// Luiz Gonzaga (d. 1989, e.g. "Asa Branca") alongside the PD Chiquinha Gonzaga; "waller"
// would admit Fats Waller's co-authored songs ("Ain't Misbehavin'", co-written by Harry
// Brooks, d. 1970) that his own 1943 death does not clear.

// A handful of composers whose PDMX field truncates or continues the surname
// ("Tchaikovsky", "Rachmaninoff", "Mussorgsky"): match the stem with a trailing \w* so a
// suffixed form still matches. Distinctive enough that a false positive is implausible.
const PD_STEMS = /\b(tchaikov|tschaikow|rachmanin|mussorg|moussorg)\w*/;

// True when the composition is confidently public domain. Composer-name patterns read
// ONLY the composer field (a title word like "bachelor" must never admit a song); the
// traditional/anonymous markers may land in either field, so those read both.
export function isPublicDomain(composer: string, title = ""): boolean {
    if (composer.trim() === "") {
        return false; // no attribution — can't confirm anything
    }
    if (TRADITIONAL.test(fold(`${composer} ${title}`))) {
        return true;
    }
    // A "(birth–death)" range: the second year is the death year.
    const range = composer.match(/\b1[0-9]\d\d\s*[-–—]\s*(1[0-9]\d\d)\b/);
    if (range && Number(range[1]) <= DEATH_CUTOFF) {
        return true;
    }
    const name = fold(composer);
    return PD_SURNAMES.test(name) || PD_STEMS.test(name);
}
