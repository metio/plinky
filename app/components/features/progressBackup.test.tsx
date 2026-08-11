// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { memoryStore } from "../../adapters/memoryStore";
import { m } from "../../paraglide/messages.js";
import { renderWithServices } from "../../testing/renderWithServices";
import { ProgressBackup } from "./progressBackup";

const device = {
    "plinky:prefs": "{}",
    "plinky:mastery:scale-c-major": '{"bestScore":91}',
};

function fileInput(container: HTMLElement): HTMLInputElement {
    const input = container.querySelector('input[type="file"]');
    if (!input) {
        throw new Error("file input not found");
    }
    return input as HTMLInputElement;
}

// A restore that lands calls window.location.reload, which jsdom cannot perform —
// so these cover the paths that stop short of it. That a landing restore replaces
// the device's state is pinned in app/lib/progressBackup.test.ts against the store
// itself, where the outcome is observable rather than navigated away from.
afterEach(cleanup);

describe("ProgressBackup", () => {
    it("says what a backup would carry", () => {
        renderWithServices(<ProgressBackup />, { store: memoryStore(device) });

        expect(screen.getByText(/2 items/)).toBeTruthy();
    });

    it("offers no download on a device holding nothing", () => {
        renderWithServices(<ProgressBackup />, { store: memoryStore() });

        expect(
            screen
                .getByRole("button", { name: m.progress_backup_download() })
                .hasAttribute("disabled"),
        ).toBe(true);
    });

    it("asks to confirm before a restore can replace anything", () => {
        renderWithServices(<ProgressBackup />, { store: memoryStore(device) });

        // Naming the consequence comes before the file picker, not after it.
        expect(
            screen.queryByRole("button", { name: m.progress_backup_restore_confirm() }),
        ).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: m.progress_backup_restore() }));
        expect(
            screen.getByRole("button", { name: m.progress_backup_restore_confirm() }),
        ).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: m.action_cancel() }));
        expect(
            screen.queryByRole("button", { name: m.progress_backup_restore_confirm() }),
        ).toBeNull();
    });

    it("reports an unreadable file and leaves the device alone", async () => {
        const store = memoryStore(device);
        const { container } = renderWithServices(<ProgressBackup />, { store });

        fireEvent.change(fileInput(container), {
            target: { files: [new File(["not json"], "x.json")] },
        });

        expect((await screen.findByRole("alert")).textContent).toBe(
            m.progress_backup_error_unreadable(),
        );
        expect(store.get("plinky:mastery:scale-c-major")).toBe('{"bestScore":91}');
    });

    it("names storage as the reason when the device refuses the writes", async () => {
        const store = { ...memoryStore(device), set: () => false };
        const { container } = renderWithServices(<ProgressBackup />, { store });
        const backup = JSON.stringify({
            format: "plinky-progress",
            version: 1,
            entries: { prefs: "{}" },
        });

        fireEvent.change(fileInput(container), {
            target: { files: [new File([backup], "backup.json")] },
        });

        expect((await screen.findByRole("alert")).textContent).toBe(
            m.progress_backup_error_storage(),
        );
    });

    it("ignores a slower earlier pick once a newer file has landed", async () => {
        const { container } = renderWithServices(<ProgressBackup />, {
            store: memoryStore(device),
        });
        let releaseSlow = () => {};
        const slow = {
            name: "a.json",
            text: () =>
                new Promise<string>((resolve) => {
                    releaseSlow = () => resolve("not json");
                }),
        };
        const fast = { name: "b.json", text: () => Promise.resolve("{}") };

        const input = fileInput(container);
        fireEvent.change(input, { target: { files: [slow] } });
        fireEvent.change(input, { target: { files: [fast] } });

        // The newer pick is a valid document that is not a backup, so it reports the
        // same unreadable problem — the stale read must not overwrite that verdict.
        expect((await screen.findByRole("alert")).textContent).toBe(
            m.progress_backup_error_unreadable(),
        );
        releaseSlow();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(screen.getAllByRole("alert")).toHaveLength(1);
    });
});
