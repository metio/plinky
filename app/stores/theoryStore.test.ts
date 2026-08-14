// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { courseProgress, LESSONS } from "../../core/theoryCourse";
import { memoryStore } from "../adapters/memoryStore";
import { createTheoryStore } from "./theoryStore";

const lessonId = LESSONS[0]!.id;

describe("the theory store", () => {
    it("remembers a lesson the first time it is met", () => {
        const store = createTheoryStore(memoryStore());
        expect(store.met().has(lessonId)).toBe(false);
        store.markMet(lessonId);
        expect(store.met().has(lessonId)).toBe(true);
    });

    it("meeting the same lesson twice changes nothing", () => {
        const kv = memoryStore();
        const store = createTheoryStore(kv);
        store.markMet(lessonId);
        const listener = vi.fn();
        store.subscribe(listener);
        store.markMet(lessonId);
        expect(listener).not.toHaveBeenCalled();
        expect(store.met().size).toBe(1);
    });

    it("refuses an id that is not a lesson", () => {
        const store = createTheoryStore(memoryStore());
        store.markMet("not-a-lesson");
        expect(store.met().size).toBe(0);
    });

    it("drops a remembered id the course no longer has", () => {
        const kv = memoryStore();
        kv.set("plinky:theory", JSON.stringify([lessonId, "a-lesson-that-was-removed"]));
        expect([...createTheoryStore(kv).met()]).toEqual([lessonId]);
    });

    it("carries the course to finished once every lesson has been met", () => {
        const store = createTheoryStore(memoryStore());
        for (const lesson of LESSONS) {
            store.markMet(lesson.id);
        }
        // What Today reads to stop offering a course there is nothing left of.
        expect(courseProgress(store.met())).toBe(1);
    });
});
