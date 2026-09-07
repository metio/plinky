// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { keepOfflineAnnouncer } from "./keepOffline";

describe("keepOfflineAnnouncer", () => {
    it("asks the active worker to keep the language's pages", async () => {
        const sent: unknown[] = [];
        const announce = keepOfflineAnnouncer({
            ready: Promise.resolve({ active: { postMessage: (m: unknown) => sent.push(m) } }),
        });
        expect(await announce("de")).toBe(true);
        expect(sent).toEqual([{ type: "KEEP_OFFLINE", locale: "de" }]);
    });

    it("says so when no worker is in charge yet", async () => {
        const announce = keepOfflineAnnouncer({ ready: Promise.resolve({ active: null }) });
        expect(await announce("de")).toBe(false);
    });
});
