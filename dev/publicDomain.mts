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

const TRADITIONAL =
    /\btrad\b|tradition|anonym|anonimo|\bfolk\b|spiritual|kinderlied|volkslied|\bhymn\b|\bcarol\b|nursery|children'?s song|public[ -]?domain|\bsacred\b|gregorian|plainchant|\bchant\b|shanty|wiegenlied|weihnacht|\bnoel\b|\bnoël\b/i;

// Well-known public-domain composers (died > 70 years ago). Not exhaustive — the death
// range catches the rest where the dates are given.
const PD_COMPOSERS =
    /\b(bach|mozart|beethoven|chopin|schubert|brahms|haendel|handel|vivaldi|haydn|tchaikov|tschaikow|debussy|satie|grieg|schumann|liszt|rossini|mendelssohn|clementi|czerny|scarlatti|purcell|joplin|sousa|pachelbel|telemann|elgar|dvorak|dvořák|verdi|wagner|bizet|saint-?sa[eë]ns|faur[eé]|alb[eé]niz|granados|mussorgsky|moussorgsky|rimsky|borodin|burgm[uü]ller|gurlitt|kuhlau|diabelli|hanon|gounod|offenbach|paganini|carcassi|giuliani|t[aá]rrega|ravel|gershwin|mascagni|puccini|smetana|sibelius|holst|nielsen|janacek|janáček|scriabin|rachmanin|gade|macdowell|nevin|streabbog|spindler|reinecke|kirchner|lemoine|couppey|bertini|loeschhorn|duvernoy|k[oö]hler|wohlfahrt|schytte|gillock|heller|\bfield\b|\bsor\b|albinoni|corelli|couperin|rameau|lully|tartini|boccherini|cherubini|hummel|weber|paderewski|albeniz|grieg|massenet|delibes|chaminade|moszkowski|sinding|sgambati|raff|thalberg|moscheles|cramer)\b/i;

// True when the composition is confidently public domain. Reads the composer field
// (and the title, for "traditional"/"anonymous" markers that land there).
export function isPublicDomain(composer: string, title = ""): boolean {
    const text = `${composer} ${title}`.trim();
    if (composer.trim() === "") {
        return false; // no attribution — can't confirm anything
    }
    if (TRADITIONAL.test(text)) {
        return true;
    }
    // A "(birth–death)" range: the second year is the death year.
    const range = composer.match(/\b1[0-9]\d\d\s*[-–—]\s*(1[0-9]\d\d)\b/);
    if (range && Number(range[1]) <= DEATH_CUTOFF) {
        return true;
    }
    return PD_COMPOSERS.test(composer);
}
