// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { markLearned } from "../../../core/mastery";
import { memoryStore } from "../../adapters/memoryStore";
import { createMasteryStore } from "../../stores/masteryStore";
import { renderWithServices } from "../../testing/renderWithServices";

import { MarkLearnedButton } from "./markLearnedButton";

afterEach(cleanup);

describe("MarkLearnedButton", () => {
    it("marks the piece learned, then hides as the store re-renders it", () => {
        const { services } = renderWithServices(<MarkLearnedButton id="btn-click" />);
        fireEvent.click(screen.getByRole("button", { name: /learned/i }));
        expect(screen.queryByRole("button", { name: /learned/i })).toBeNull();
        expect(services.mastery.load("btn-click")?.learned).toBe(true);
    });

    it("renders nothing for an already-learned piece", () => {
        const kv = memoryStore();
        const mastery = createMasteryStore(kv);
        mastery.save("btn-learned", markLearned(null, Date.now()));
        const { container } = renderWithServices(<MarkLearnedButton id="btn-learned" />, {
            store: kv,
            mastery,
        });
        expect(container.firstChild).toBeNull();
    });
});
