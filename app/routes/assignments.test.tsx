// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { encodeAssignmentLink, makeAssignment } from "../../core/assignment";
import { memoryStore } from "../adapters/memoryStore";
import { loadBundledScores } from "../lib/catalog";
import { createAssignmentsStore } from "../stores/assignmentsStore";
import type { ExerciseMeta, ExerciseSource } from "../stores/exerciseSource";
import type { SongSource } from "../stores/songSource";
import { renderWithServices } from "../testing/renderWithServices";
import AssignmentsRoute from "./assignments";

// Only `manifest` is exercised here; the rest of each source is unused.
const source = <T,>(manifest: () => Promise<never[] | null>): T => ({ manifest }) as unknown as T;
const emptySources = () => ({
    exercises: source<ExerciseSource>(() => Promise.resolve([])),
    songs: source<SongSource>(() => Promise.resolve([])),
});
// A manifest that never resolves keeps the known-piece set indeterminate.
const pendingSources = () => ({
    exercises: source<ExerciseSource>(() => new Promise<never[]>(() => {})),
    songs: source<SongSource>(() => Promise.resolve([])),
});
// A failed fetch answers null — also indeterminate, never "all pieces gone".
const failedSources = () => ({
    exercises: source<ExerciseSource>(() => Promise.resolve(null)),
    songs: source<SongSource>(() => Promise.resolve([])),
});

const bundled = loadBundledScores()[0]!;

const mount = (overrides: Parameters<typeof renderWithServices>[1], entry = "/assignments") =>
    renderWithServices(
        <MemoryRouter initialEntries={[entry]}>
            <AssignmentsRoute />
        </MemoryRouter>,
        overrides,
    );

// A saved assignment holding one resolvable piece and one dead id.
const seedStale = () => {
    const store = memoryStore();
    createAssignmentsStore(store).save(
        makeAssignment({
            id: "stale-set",
            name: "Stale set",
            items: [{ id: bundled.id }, { id: "gone-id" }],
        }),
    );
    return store;
};

afterEach(cleanup);

describe("AssignmentsRoute missing pieces", () => {
    it("labels a dead step as missing and renders no play link for it", async () => {
        mount({ store: seedStale(), ...emptySources() });
        expect(await screen.findByText("No longer on this device")).toBeTruthy();
        // The resolvable step keeps its link; the dead id gets none anywhere.
        const links = screen.getAllByRole("link");
        expect(links.some((link) => link.getAttribute("href")?.includes("gone-id"))).toBe(false);
        expect(
            links.some((link) => link.getAttribute("href")?.includes(`/play/${bundled.id}`)),
        ).toBe(true);
    });

    it("keeps rendering the normal link while the sources are still loading", async () => {
        mount({ store: seedStale(), ...pendingSources() });
        // The dead id cannot be told from a not-yet-loaded one, so nothing is
        // called missing and both steps stay links.
        await screen.findByText("Stale set");
        expect(screen.queryByText("No longer on this device")).toBeNull();
        expect(screen.queryByText("Remove missing pieces")).toBeNull();
        const links = screen.getAllByRole("link");
        expect(links.some((link) => link.getAttribute("href")?.includes("/play/gone-id"))).toBe(
            true,
        );
    });

    it("treats a failed manifest fetch as indeterminate, never as missing", async () => {
        mount({ store: seedStale(), ...failedSources() });
        // An offline moment must not brand real pieces missing, offer a prune
        // that would delete them, or claim "0 of N available".
        await screen.findByText("Stale set");
        expect(screen.queryByText("No longer on this device")).toBeNull();
        expect(screen.queryByText("Remove missing pieces")).toBeNull();
        const links = screen.getAllByRole("link");
        expect(links.some((link) => link.getAttribute("href")?.includes("/play/gone-id"))).toBe(
            true,
        );
    });

    it("shows no availability line when a manifest fetch failed", async () => {
        const code = encodeAssignmentLink(
            makeAssignment({ name: "Shared set", items: [{ id: "gone-id" }] }),
        );
        mount({ store: memoryStore(), ...failedSources() }, `/assignments?assignment=${code}`);
        await screen.findByText(/An assignment was shared/);
        expect(screen.queryByText(/available on this device/)).toBeNull();
    });

    it("prunes the missing steps and persists the surviving assignment", async () => {
        const store = seedStale();
        const { services } = mount({ store, ...emptySources() });
        fireEvent.click(await screen.findByText("Remove missing pieces"));
        const status = await screen.findByRole("status");
        expect(status.textContent).toBe('Removed the missing pieces from "Stale set".');
        expect(screen.queryByText("No longer on this device")).toBeNull();
        expect(services.assignments.list()).toEqual([
            makeAssignment({
                id: "stale-set",
                name: "Stale set",
                items: [{ id: bundled.id }],
            }),
        ]);
    });

    it("disables pruning when it would empty the assignment", async () => {
        const store = memoryStore();
        createAssignmentsStore(store).save(
            makeAssignment({ id: "all-gone", name: "All gone", items: [{ id: "gone-id" }] }),
        );
        mount({ store, ...emptySources() });
        const prune = await screen.findByText<HTMLButtonElement>("Remove missing pieces");
        expect(prune.disabled).toBe(true);
    });

    it("offers no prune action when every step resolves", async () => {
        const store = memoryStore();
        createAssignmentsStore(store).save(
            makeAssignment({ id: "fine", name: "Fine set", items: [{ id: bundled.id }] }),
        );
        mount({ store, ...emptySources() });
        await screen.findByText("Fine set");
        expect(screen.queryByText("Remove missing pieces")).toBeNull();
    });

    it("tells how many of a shared link's pieces resolve on this device", async () => {
        const code = encodeAssignmentLink(
            makeAssignment({
                name: "Shared set",
                items: [{ id: bundled.id }, { id: "gone-id" }, { id: "gone-too" }],
            }),
        );
        mount({ store: memoryStore(), ...emptySources() }, `/assignments?assignment=${code}`);
        expect(await screen.findByText("1 of 3 pieces are available on this device.")).toBeTruthy();
        // The import still goes through — the pieces may be imported later.
        fireEvent.click(screen.getByText("Import this assignment"));
        const status = await screen.findByRole("status");
        expect(status.textContent).toBe(
            'Imported "Shared set" — 1 of 3 pieces are available on this device.',
        );
    });

    it("shows no availability line before the sources have loaded", async () => {
        const code = encodeAssignmentLink(
            makeAssignment({ name: "Shared set", items: [{ id: "gone-id" }] }),
        );
        mount({ store: memoryStore(), ...pendingSources() }, `/assignments?assignment=${code}`);
        await screen.findByText(/An assignment was shared/);
        expect(screen.queryByText(/available on this device/)).toBeNull();
    });
});

describe("AssignmentsRoute picker pool dedup", () => {
    // The manifest keys entries by content fingerprint, so two entries can carry
    // the same id (an import matching a catalogue piece, or a generator glitch).
    const meta = (title: string): ExerciseMeta => ({
        id: "dup-id",
        title,
        grade: 1,
        cost: 1,
        kind: "scale-arpeggio",
        tempo: 90,
        beatsPerBar: 4,
    });

    it("renders a duplicated id once and labels the basket with the surviving title", async () => {
        mount({
            store: memoryStore(),
            exercises: source<ExerciseSource>(
                () => Promise.resolve([meta("First title"), meta("Second title")]) as never,
            ),
            songs: source<SongSource>(() => Promise.resolve([])),
        });
        // The picker lives on the builder tab.
        fireEvent.click(screen.getByRole("tab", { name: "Create new" }));
        expect(await screen.findByText("First title")).toBeTruthy();
        // The first occurrence wins; the duplicate never renders a second row.
        expect(screen.getAllByText("First title")).toHaveLength(1);
        expect(screen.queryByText("Second title")).toBeNull();
        // The pool also lists the local catalogue, so scope the click to this row.
        const row = screen.getByText("First title").closest("li")!;
        fireEvent.click(within(row).getByText("Add"));
        // The basket step is labelled from the surviving pool entry.
        expect(await screen.findByText("First title")).toBeTruthy();
        expect(screen.queryByText("Second title")).toBeNull();
    });
});

describe("AssignmentsRoute tabs", () => {
    const twoExercises = () => ({
        exercises: source<ExerciseSource>(
            () =>
                Promise.resolve([
                    {
                        id: "ex-one",
                        title: "Exercise one",
                        grade: 1,
                        cost: 1,
                        kind: "scale-arpeggio",
                        tempo: 90,
                        beatsPerBar: 4,
                    },
                    {
                        id: "ex-two",
                        title: "Exercise two",
                        grade: 1,
                        cost: 1,
                        kind: "scale-arpeggio",
                        tempo: 90,
                        beatsPerBar: 4,
                    },
                ]) as never,
        ),
        songs: source<SongSource>(() => Promise.resolve([])),
    });

    it("starts on the list tab with the builder hidden", async () => {
        mount({ store: memoryStore(), ...emptySources() });
        expect(await screen.findByRole("tab", { name: "All assignments" })).toBeTruthy();
        expect(screen.queryByLabelText("Description")).toBeNull();
        expect(screen.getByText(/No assignments yet/)).toBeTruthy();
    });

    it("saves from the builder tab, then lands back on the cleared list tab", async () => {
        mount({ store: memoryStore(), ...twoExercises() });
        fireEvent.click(screen.getByRole("tab", { name: "Create new" }));
        const row = (await screen.findByText("Exercise one")).closest("li")!;
        fireEvent.click(within(row).getByText("Add"));
        fireEvent.change(screen.getByLabelText("Assignment name"), {
            target: { value: "Warmups" },
        });
        fireEvent.change(screen.getByLabelText("Assignment description"), {
            target: { value: "Line one.\n\nLine two." },
        });
        fireEvent.click(screen.getByText("Save"));
        // Back on the list, the saved assignment shows with its full description.
        expect(await screen.findByText("Warmups")).toBeTruthy();
        expect(screen.getByText(/Line one\./)).toBeTruthy();
        // Returning to the builder finds it cleared for the next assignment.
        fireEvent.click(screen.getByRole("tab", { name: "Create new" }));
        expect((screen.getByLabelText("Assignment name") as HTMLInputElement).value).toBe("");
        expect((screen.getByLabelText("Assignment description") as HTMLTextAreaElement).value).toBe(
            "",
        );
    });

    it("editing opens the builder tab with the assignment loaded, and cancel returns", async () => {
        const store = memoryStore();
        createAssignmentsStore(store).save(
            makeAssignment({
                id: "warmups",
                name: "Warmups",
                description: "Slow first.",
                items: [{ id: bundled.id }],
            }),
        );
        mount({ store, ...emptySources() });
        fireEvent.click(await screen.findByText("Edit"));
        // The builder tab is active and holds the assignment.
        expect(screen.getByRole("tab", { name: "Edit assignment" }).ariaSelected).toBe("true");
        expect((screen.getByLabelText("Assignment name") as HTMLInputElement).value).toBe(
            "Warmups",
        );
        expect(screen.getByText(/saving updates it/)).toBeTruthy();
        // Cancel abandons the edit and returns to the intact list.
        fireEvent.click(screen.getByText("Cancel"));
        expect(await screen.findByText("Warmups")).toBeTruthy();
        fireEvent.click(screen.getByRole("tab", { name: "Create new" }));
        expect((screen.getByLabelText("Assignment name") as HTMLInputElement).value).toBe("");
    });

    it("reorders basket rows by dragging a title", async () => {
        mount({ store: memoryStore(), ...twoExercises() });
        fireEvent.click(screen.getByRole("tab", { name: "Create new" }));
        for (const title of ["Exercise one", "Exercise two"]) {
            const row = (await screen.findByText(title)).closest("li")!;
            fireEvent.click(within(row).getByText("Add"));
        }
        const basket = screen
            .getByText("Drag a title to reorder, or use the arrow buttons.")
            .parentElement!.querySelector("ol")!;
        // jsdom has no layout; give the two rows real vertical bands.
        Array.from(basket.children).forEach((child, index) => {
            (child as HTMLElement).getBoundingClientRect = () =>
                ({ top: index * 40, height: 40 }) as DOMRect;
        });
        const rows = () =>
            Array.from(basket.querySelectorAll("li")).map((row) => row.textContent ?? "");
        expect(rows()[0]).toContain("Exercise one");
        const handle = within(basket).getByText("Exercise one");
        fireEvent.pointerDown(handle, { pointerId: 1, clientY: 20 });
        fireEvent.pointerMove(handle, { pointerId: 1, clientY: 65 });
        fireEvent.pointerUp(handle, { pointerId: 1 });
        expect(rows()[0]).toContain("Exercise two");
        expect(rows()[1]).toContain("Exercise one");
    });
});
