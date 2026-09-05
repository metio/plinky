// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Puts text on the clipboard and says whether it landed. False where there is no Clipboard
// API at all — an insecure origin, some in-app views — and where the browser refused the
// write; either way the caller must not say "Copied", or it sends somebody off to paste
// nothing. The one place the decision is made: four copies of it had two behaviours.
export async function copyText(text: string): Promise<boolean> {
    const clipboard = globalThis.navigator?.clipboard;
    if (!clipboard) {
        return false;
    }
    try {
        await clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}
