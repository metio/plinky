// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// True for iPhone / iPad / iPod. iPadOS 13+ reports a desktop-Safari user agent
// that says "Macintosh", so it is only distinguishable by exposing multi-touch —
// real Macs report zero touch points. The composition root passes
// `navigator.userAgent` and `navigator.maxTouchPoints`; keeping the decision pure
// lets it be tested without stubbing browser globals.
//
// It exists because iOS Safari routes Web Audio to the ringer channel that Silent
// Mode mutes — sound the app can neither detect nor override — so an iOS visitor
// gets a tip to check Silent Mode and the volume.
export function isIosLike(userAgent: string, maxTouchPoints: number): boolean {
    if (/\b(?:iPhone|iPad|iPod)\b/.test(userAgent)) {
        return true;
    }
    return userAgent.includes("Macintosh") && maxTouchPoints > 1;
}
