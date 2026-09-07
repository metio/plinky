// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { cardJobs } from "./gen-og.mts";

describe("cardJobs", () => {
    const jobs = cardJobs();

    it("paints one card for every piece the catalogue holds, bundled ones included", () => {
        expect(jobs.length).toBeGreaterThan(3000);
        expect(new Set(jobs.map((job) => job.id)).size).toBe(jobs.length);
        // Ode to Joy, bundled: its mark is read from the notation rather than the manifest.
        const ode = jobs.find((job) => job.id === "47xd2XDpYFCy");
        expect(ode?.incipit?.notes.length).toBeGreaterThan(0);
        expect(ode?.composer).toBe("Ludwig van Beethoven");
    });

    it("credits the people the app credits, in the app's spelling", () => {
        for (const job of jobs) {
            expect(job.composer).not.toMatch(/^\s|\s$/);
        }
    });
});
