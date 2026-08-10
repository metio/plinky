// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Hands the current page to the browser's own print dialogue. Printing a score
// needs a rendered copy of its own and lives in printScore.ts; a report is already
// on the page, so the only thing missing is the chrome, which the `print:hidden`
// utilities on the nav bar and footer take off.
//
// A browser with no print support (an embedded webview) simply does nothing, which
// is the right outcome for a button the player can always ignore.
export function printPage(): void {
    if (typeof window !== "undefined" && typeof window.print === "function") {
        window.print();
    }
}
