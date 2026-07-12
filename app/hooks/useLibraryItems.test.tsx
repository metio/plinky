// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { makeAssignment } from "../../core/assignment";
import { memoryStore } from "../adapters/memoryStore";
import { domXmlCodec } from "../adapters/domXmlCodec";
import { ServicesProvider } from "../contexts/services";
import { buildScore, loadBundledScores, saveUserScore } from "../lib/catalog";
import { createAssignmentsStore } from "../stores/assignmentsStore";
import { createMasteryStore } from "../stores/masteryStore";
import type { ExerciseSource } from "../stores/exerciseSource";
import type { SongSource } from "../stores/songSource";
import { useLibraryItems } from "./useLibraryItems";

// Only `manifest` is exercised; the rest of each source is unused here.
const source = <T,>(manifest: () => Promise<unknown>): T => ({ manifest }) as unknown as T;

const USER_XML = `<?xml version="1.0"?><score-partwise><work><work-title>My Tune</work-title></work><part id="P1"><measure number="1"><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;

const wrap =
    (store: ReturnType<typeof memoryStore>, exercises: ExerciseSource, songs: SongSource) =>
    ({ children }: { children: ReactNode }) => (
        <ServicesProvider services={{ store, exercises, songs }}>{children}</ServicesProvider>
    );

const emptySources = () => ({
    exercises: source<ExerciseSource>(() => Promise.resolve([])),
    songs: source<SongSource>(() => Promise.resolve([])),
});

describe("useLibraryItems", () => {
    it("combines local scores with both manifests, local first, and flags loaded", async () => {
        const store = memoryStore();
        saveUserScore(store, buildScore(domXmlCodec, USER_XML, []));
        const exercises = source<ExerciseSource>(() =>
            Promise.resolve([
                { id: "ex-1", title: "Scale of C", grade: 1, kind: "scale-arpeggio" },
            ]),
        );
        const songs = source<SongSource>(() =>
            Promise.resolve([{ id: "song-1", title: "Air", composer: "Bach", grade: 3 }]),
        );
        const { result } = renderHook(() => useLibraryItems(), {
            wrapper: wrap(store, exercises, songs),
        });
        await waitFor(() => expect(result.current.loaded).toBe(true));
        // Local scores (the user import plus the bundled demos) come first, then
        // the exercise manifest, then the song manifest.
        const titles = result.current.items.map((item) => item.title);
        expect(titles[0]).toBe("My Tune");
        expect(titles.slice(-2)).toEqual(["Scale of C", "Air"]);
        expect(titles.length).toBe(loadBundledScores().length + 3);
        // Only the user import is removable; an absent composer reads as "".
        const byTitle = (title: string) =>
            result.current.items.find((entry) => entry.title === title);
        expect(byTitle("My Tune")?.removable).toBe(true);
        expect(result.current.items.filter((entry) => entry.removable)).toHaveLength(1);
        expect(byTitle("Scale of C")?.composer).toBe("");
        expect(byTitle("Scale of C")?.kind).toBe("scale-arpeggio");
    });

    it("stays unloaded until the manifests resolve, showing local scores meanwhile", () => {
        const store = memoryStore();
        saveUserScore(store, buildScore(domXmlCodec, USER_XML, []));
        const pending = source<ExerciseSource>(() => new Promise(() => {}));
        const songs = source<SongSource>(() => Promise.resolve([]));
        const { result } = renderHook(() => useLibraryItems(), {
            wrapper: wrap(store, pending, songs),
        });
        expect(result.current.loaded).toBe(false);
        expect(result.current.items.map((item) => item.title)).toContain("My Tune");
        expect(result.current.items).toHaveLength(loadBundledScores().length + 1);
    });

    it("lists nothing beyond the local catalogue for a failed (null) manifest", async () => {
        const store = memoryStore();
        const exercises = source<ExerciseSource>(() => Promise.resolve(null));
        const songs = source<SongSource>(() => Promise.resolve(null));
        const { result } = renderHook(() => useLibraryItems(), {
            wrapper: wrap(store, exercises, songs),
        });
        await waitFor(() => expect(result.current.loaded).toBe(true));
        expect(result.current.items).toHaveLength(loadBundledScores().length);
    });

    it("removes a user score from the list", async () => {
        const store = memoryStore();
        const score = buildScore(domXmlCodec, USER_XML, []);
        saveUserScore(store, score);
        const { exercises, songs } = emptySources();
        const { result } = renderHook(() => useLibraryItems(), {
            wrapper: wrap(store, exercises, songs),
        });
        await waitFor(() => expect(result.current.loaded).toBe(true));
        const bundled = loadBundledScores().length;
        expect(result.current.items).toHaveLength(bundled + 1);
        act(() => result.current.remove(score.id));
        expect(result.current.items).toHaveLength(bundled);
        expect(result.current.items.map((entry) => entry.title)).not.toContain("My Tune");
    });

    it("loads the mastery map and counts referencing assignments", async () => {
        const store = memoryStore();
        const score = buildScore(domXmlCodec, USER_XML, []);
        saveUserScore(store, score);
        createMasteryStore(store).save(score.id, {
            bestScore: 90,
            learned: true,
            backlog: false,
            intervalDays: 5,
            reviewAt: 1,
            updatedAt: 0,
        });
        createAssignmentsStore(store).save(
            makeAssignment({ id: "set", name: "Set", items: [{ id: score.id }] }),
        );
        const { exercises, songs } = emptySources();
        const { result } = renderHook(() => useLibraryItems(), {
            wrapper: wrap(store, exercises, songs),
        });
        await waitFor(() => expect(result.current.loaded).toBe(true));
        expect(result.current.mastery[score.id]?.learned).toBe(true);
        expect(result.current.assignmentsUsing(score.id)).toBe(1);
        expect(result.current.assignmentsUsing("nothing-like-this")).toBe(0);
    });
});
