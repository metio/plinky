// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { trackSteps } from "../../../core/tracks";
import { m } from "../../paraglide/messages.js";
import { AssignmentStepList } from "./assignmentCard";

afterEach(cleanup);

// Four quarter notes on a treble staff, in the form the catalogue bakes.
const MARK = "G30q30q31q32q";

const TITLES: Record<string, string> = { first: "Für Elise", second: "Minuet in G" };

const show = (options: {
    incipitOf?: (id: string) => string | undefined;
    isMissing?: (id: string) => boolean;
}) =>
    render(
        <MemoryRouter>
            <AssignmentStepList
                steps={trackSteps(["first", "second"], () => false)}
                titleOf={(id) => TITLES[id] ?? id}
                isMissing={options.isMissing ?? (() => false)}
                incipitOf={options.incipitOf}
            />
        </MemoryRouter>,
    );

describe("an assignment's steps", () => {
    it("draws the opening bars of a step the catalogue has a mark for", () => {
        show({ incipitOf: (id) => (id === "first" ? MARK : undefined) });
        // The mark is described by the piece it names, so a reader who cannot see it
        // hears the title rather than a transcription of the notes.
        expect(screen.getByRole("img", { name: TITLES.first })).toBeTruthy();
        // A step with no mark keeps its row and simply shows none.
        expect(screen.queryByRole("img", { name: TITLES.second })).toBeNull();
        expect(screen.getByText(TITLES.second!)).toBeTruthy();
    });

    it("still names every step when nothing carries a mark", () => {
        show({});
        expect(screen.queryAllByRole("img")).toHaveLength(0);
        for (const title of Object.values(TITLES)) {
            expect(screen.getByText(title)).toBeTruthy();
        }
    });

    it("draws nothing for a step this device cannot resolve", () => {
        // A shared set naming a piece that is not here is a labelled placeholder, never
        // a link into the play page's dead end — and never a mark for music it has not
        // got.
        show({ incipitOf: () => MARK, isMissing: (id) => id === "first" });
        expect(screen.getByText(m.assignments_step_missing())).toBeTruthy();
        expect(screen.queryByRole("img", { name: TITLES.first })).toBeNull();
        expect(screen.getByRole("img", { name: TITLES.second })).toBeTruthy();
    });
});
