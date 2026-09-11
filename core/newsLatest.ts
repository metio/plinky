// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Generated from changelog.yaml by dev/changelog.mts — do not edit.
//
// The newest releases, in the page's own bundle so the /news document says what
// changed without waiting for a fetch. The rest of the list is fetched.

import type { Release } from "./changelog";

export const LATEST_RELEASES: Release[] = [
    {
        date: "2026-09-11",
        label: "night",
        entries: [
            {
                body: "**Ear training answers from your number keys.** On a scale-degree question, typing 3\nanswers \"3\" just as clicking it does, and in melodic dictation each number you type\nfills the next note. Chord progressions take the number of the chord's degree, so 4\nis IV and 5 is V; each chord button now shows its number in the corner. A number the\nquestion doesn't offer is left alone. The number pad works too, and so does the\nnumber row on a French keyboard, with or without Shift. With a screen reader, you\nhear each note or chord as you fill it in, and which of the slots it went into.",
                twip: true,
            },
        ],
    },
    {
        date: "2026-09-11",
        label: "evening",
        entries: [
            {
                body: "**The last few English note names now use your keys' names too.** The notes held\nin the MIDI settings, the note the microphone hears and the one its setup asks\nfor, your hand size, your piano's range, the drill's range and key, the key on the\nhome page's Arcade button, the fingering editor and the notes you take longest to\nfind on Stats all still printed English letters. A German player read B4 where the\nkeys said H, and a French player read A4 beside keys saying la. They now name every\nnote the way your keys do. Your note names also follow the page's language until\nyou choose them yourself in Settings: changing the volume no longer fixes them in\nplace. In Norwegian, B natural is now called H by default, as Norwegian music\nbooks call it; B is one choice away in Settings.",
                twip: true,
            },
            {
                body: "**Note names on the keys are easier to read.** The names printed on the on-screen\nkeys were a pale grey that was hard to make out on a white key, and harder still on\none lit green, red or blue. They are darker now, and on a lit key they change with\nits colour, so a name stays readable whichever state the key is in, on every\nkeyboard look, in light and dark mode.",
                twip: true,
            },
            {
                body: "**A note Keep going passes over no longer counts as perfectly timed.** The share\ngrid and the note-by-note strip after a run scored a skipped note as played on the\nbeat and at full speed, so a slow run with a few skips looked greener than it was,\nand could even name the wrong hand as the one lagging. Your grade already left skips\nout of its timing, and now the grid and the strip do too. A skipped note still counts\nas a slip, and on the strip it shows as just its red ring, with no timing dot.",
                twip: true,
            },
            {
                body: "**With the microphone on, your first notes after stopping Listen are heard.** Plinky\nignores what the microphone hears of its own speaker, and it kept ignoring a note\nListen had played for as long as that note would have rung, even once Stop had\nsilenced it. Start a piece straight after listening and its opening notes, the ones\nListen had just played, could go unheard for a few seconds. A stopped note now stops\ncounting as Plinky's own the moment it goes quiet.",
                twip: true,
            },
            {
                body: '**Every note is called what your keys call it.** The keys could say do re mi, but\nthe chord under your hands, the ear-training keys, the key mapping, the tools and\ntheory pages and a scale\'s name still said C, D and E. In Danish, Polish, Czech and\nthe other languages that call B natural H, the key above A sharp was still printed\nand read out as "B" — which there means B flat. Now whatever your keys say, every\nother screen says too: "Gamme de si bémol majeur", "Ré Majeur", H for B natural.\nFrench, Italian, Spanish, Portuguese and the other do-re-mi languages start on do re\nmi, and **Settings** lets you choose between B and H if you learned the other.',
                twip: true,
            },
            {
                body: '**A new take in Compose is named in your language.** Its title started as the\nEnglish word "Improvisation" in every language, and that word went on to name the\nMIDI and MusicXML files you download and head the score they open as. It now starts\nin your own language — "Improvisación", "Improvvisazione", "即興演奏" — and you can\nstill rename it.',
                twip: true,
            },
            {
                body: '**A screen reader names the piano\'s keys in your language.** Every key on the\non-screen keyboard, and the wrong-note announcement, was read out in English\nwhatever language Plinky was in, so a German page said "Falsche Note: F sharp 4".\nKeys are now read out in your language, with the same note names as the rest of\nPlinky: "Falsche Note: Fis 4" in German, with H for B natural, and "Mauvaise note :\ndo dièse 4" in French.',
                twip: true,
            },
            {
                body: "**In German, the circle of fifths calls B natural H.** German reads the letter B as\nB flat, so the Tools page told a German reader that D major's relative minor was\nB-Moll, and named the key of five sharps B. The circle, its signatures, the chord\nsheet you can save, the scale, chord and interval pickers and the key-signature lesson\nin Theory now use the German names: h-Moll, Fis · Cis, H for B natural and B for B flat.",
                twip: true,
            },
            {
                body: "**Left hand as chords works on songs with a singer.** With Other parts showing, a\nsong whose singer is written above the piano kept the composer's full left hand when\nyou chose Left hand as chords, and the run still counted as a practice version. The\npiano's left hand now turns into chords under the singer's line, as it does on a\npiece for piano alone.",
                twip: true,
            },
            {
                body: "**Stopping Listen stops the sound.** Press Listen again to stop it, restart it, or\nstop a run you are replaying, and the cursor stopped while the notes already played\nrang on, a pedalled bass for a bar or more, and under the next pass if you started\nagain. Playing a sketch back in Compose did the same after Stop. The notes now fade\nthe moment you stop, and anything you are holding on your own keys keeps sounding. A\npiece that plays to its end still lets its last chord ring.",
                twip: true,
            },
            {
                body: "**Keep up counts a grace note played a hair late.** A beat in Keep up stays open\nfor a moment after the cursor moves on, so a note played just after it still counts.\nA very short beat, such as a grace note or a fast semiquaver, could have that moment\ncut short by the beat before it, and a note played inside it was marked as missed.\nEvery beat now keeps its full moment.",
                twip: true,
            },
            {
                body: "**With Keep going on, a missed note no longer makes the next one look early.** When\nyou skipped a note and played the next one right on its beat, the result timed the\nskipped note as late and the one you played as early, so a single miss cost you\ntwice on timing and put a note you got right on the strip as off the beat. The\nmissed note still counts as missed, and the notes you played are timed as you\nplayed them.",
                twip: true,
            },
            {
                body: "**A run's video shows the piece's own notation after One hand at a time.** Trying\nOne hand at a time from Ways to practise can open a tune written on a single staff.\nYou play it with both hands, but the run was kept as a left-hand run, so its video\ncould not find those notes in the score and drew your playing out as new notation\ninstead. The run is now kept as the both-hands run it was, and its video shows the\npiece as written.",
                twip: true,
            },
            {
                body: "**All time on the Stats page shows your practice.** With the period set to All\ntime, the practice report said there was nothing here yet, however much you had\nlogged, while the week, the month and the year showed it. It now adds up every\nsitting since your first, and its calendar starts on that day.",
                twip: true,
            },
            {
                body: "**An address without a language opens its page, slash or no slash.** Typing\nplinky.fun/music/, or taking the language out of a link you copied, opened the Today\npage, while the same address without the final slash opened Music. Both now open the\npage they name, in your language.",
                twip: true,
            },
            {
                body: "**The Due now filter keeps its button when nothing is due.** Filter Music to Due\nnow, play the piece that was due, come back, and the list was empty with no button\nleft to turn the filter off. The Due now button now stays while the filter is on,\nso one tap brings the whole shelf back.",
                twip: true,
            },
            {
                body: "**Compose's replace question follows the last file you opened.** Asked whether to\nreplace your take with one file, you could open another instead; if that one would\nnot open, the question stayed up, and Replace loaded the first file after all.\nOpening a new file now withdraws the question about the earlier one.",
                twip: true,
            },
            {
                body: "**A damaged MIDI file no longer spoils a Compose link.** A file carrying a note\nhigher than the top of the keyboard, or louder than MIDI allows, opened in Compose\nwithout complaint, and the link you shared from it opened an empty take for the\nperson you sent it to. Compose now leaves those damaged notes out when it opens the\nfile, so everything it shows can be shared.",
                twip: true,
            },
        ],
    },
];
