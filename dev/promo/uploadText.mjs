// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One shape for every file somebody uploads from: the title, then the description, each
// under a heading that says which box it belongs in.
//
// These files used to open with a bare line, a blank line, and the description — a
// convention obvious to whoever wrote the generator and to nobody else. YouTube asks for
// two separate fields, so a reader either knew to split at the first blank line or pasted
// a title into a description. Labelling costs two lines and removes the guess.

const RULE = "─".repeat(60);

export function uploadText(title, description) {
    return [
        "TITLE — paste into the title box",
        RULE,
        title,
        "",
        "DESCRIPTION — paste into the description box, from here down",
        RULE,
        description,
        "",
    ].join("\n");
}
