// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { importSongsPack } from "./songs";

const SEEDED_KEY = "plinky:seeded";
const STARTER_URL = "/registry/starter.json";

// Seed the starter songs from the registry the first time the app runs, so a
// fresh visitor has something to practice without songs being bundled into the
// app. The flag is set only on a successful import, so an offline first visit
// retries on the next run, and songs the user later deletes are not re-seeded.
export async function seedStarterSongs(): Promise<void> {
    if (typeof localStorage === "undefined" || localStorage.getItem(SEEDED_KEY)) {
        return;
    }
    try {
        const response = await fetch(STARTER_URL);
        if (!response.ok) {
            return;
        }
        importSongsPack(await response.text());
        localStorage.setItem(SEEDED_KEY, "1");
    } catch {
        // Offline or unreachable: leave the flag unset so the next run retries.
    }
}
