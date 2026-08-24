// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Handing something to somebody else: the native share sheet where the browser has one,
// the clipboard where it does not.
//
// Three surfaces do this — an assignment, a ghost run, a month's recap — and all three
// had their own copy of the same three decisions. Each one is easy to get subtly wrong in
// isolation:
//
//   - The confirmation belongs to the CLIPBOARD path only. A share sheet says its own piece
//     and a second "copied!" underneath it is a lie about what happened.
//   - It comes after the write, not before: a blocked clipboard that still flashed
//     "copied" would send somebody off to paste nothing.
//   - A cancelled share throws, and so does a blocked clipboard. Neither is a failure worth
//     telling anybody about — somebody who changed their mind does not need an error — so
//     both are swallowed, and only a landed share or a real copy is reported.
//
// What differs between the callers is only what they hand over, so that is all they pass.
export async function shareOrCopy({
    share,
    copy,
    onCopied,
}: {
    // What the native sheet is given.
    share: ShareData;
    // What lands on the clipboard instead. Not always the same as the share's url: a recap
    // has no page of its own to point at, so it copies its sentence and the site together.
    copy: string;
    // Confirm the copy — on the clipboard path alone.
    onCopied: () => void;
}): Promise<void> {
    try {
        if (typeof navigator.share === "function") {
            await navigator.share(share);
            return;
        }
        await navigator.clipboard?.writeText(copy);
        onCopied();
    } catch {
        // A cancelled share or a blocked clipboard needs no message.
    }
}
