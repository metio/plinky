// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { MemoryRouter } from "react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { arcadeConfig } from "../../../core/arcade";
import { buildExerciseId } from "../../../core/exerciseGen";
import { markLearned } from "../../../core/mastery";
import { memoryStore } from "../../adapters/memoryStore";
import { ServicesProvider } from "../../contexts/services";
import { createMasteryStore } from "../../stores/masteryStore";
import { m } from "../../paraglide/messages.js";
import { ArcadeCard } from "./arcadeCard";

afterEach(cleanup);

function renderCard(mastery = createMasteryStore(memoryStore())) {
    return render(
        <MemoryRouter>
            <ServicesProvider services={{ mastery }}>
                <ArcadeCard />
            </ServicesProvider>
        </MemoryRouter>,
    );
}

describe("ArcadeCard", () => {
    it("starts a fresh player on level 1", async () => {
        renderCard();
        expect(await screen.findByText(m.arcade_play({ level: 1 }))).toBeTruthy();
    });

    it("advances to the next uncleared level once earlier ones are mastered", async () => {
        const mastery = createMasteryStore(memoryStore());
        // Clear levels 1 and 2 by marking their exercises learned.
        for (const level of [1, 2]) {
            mastery.save(buildExerciseId(arcadeConfig(level)), markLearned(null, 0));
        }
        renderCard(mastery);
        await waitFor(() => expect(screen.getByText(m.arcade_play({ level: 3 }))).toBeTruthy());
    });

    it("links into the play surface with the level's generated exercise", async () => {
        renderCard();
        const link = await screen.findByRole("link", { name: m.arcade_play({ level: 1 }) });
        expect(link.getAttribute("href")).toContain(`/play/${buildExerciseId(arcadeConfig(1))}`);
    });
});
