// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";
import { webStoragePersistence } from "./webStoragePersistence";

// The real StorageManager is not available under node, and the browsers disagree about
// it anyway, so what is pinned here is the adapter's own contract: ask cheaply first,
// never throw, and treat every unknown as "evictable", which is what was true before.
type Manager = { persisted?: unknown; persist?: unknown };

function withStorage(manager: Manager | undefined) {
    vi.spyOn(globalThis, "navigator", "get").mockReturnValue({
        storage: manager,
    } as unknown as Navigator);
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe("webStoragePersistence", () => {
    it("does not ask again when the grant already exists", async () => {
        // Re-asking costs a prompt in the browsers that put it to the player, and this
        // runs after every first run of a session.
        const persist = vi.fn(async () => true);
        withStorage({ persisted: async () => true, persist });

        expect(await webStoragePersistence.ensure()).toBe(true);
        expect(persist).not.toHaveBeenCalled();
    });

    it("asks when the grant is missing, and reports what it got", async () => {
        withStorage({ persisted: async () => false, persist: async () => true });

        expect(await webStoragePersistence.ensure()).toBe(true);
    });

    it("reports evictable when the player declines", async () => {
        withStorage({ persisted: async () => false, persist: async () => false });

        expect(await webStoragePersistence.ensure()).toBe(false);
    });

    it("reports evictable on a browser without the API", async () => {
        withStorage(undefined);
        expect(await webStoragePersistence.ensure()).toBe(false);

        withStorage({});
        expect(await webStoragePersistence.ensure()).toBe(false);
    });

    it("reports evictable rather than throwing when the call fails", async () => {
        // Some contexts reject outright (a sandboxed frame, storage blocked by policy).
        // A refused promise here must not take down the run that was being recorded.
        withStorage({
            persisted: async () => {
                throw new Error("blocked");
            },
            persist: async () => true,
        });

        await expect(webStoragePersistence.ensure()).resolves.toBe(false);
    });
});
