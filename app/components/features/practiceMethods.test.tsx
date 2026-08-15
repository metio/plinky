// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { METHODS } from "../../../core/practiceMethods";
import { m } from "../../paraglide/messages.js";
import { PracticeMethods } from "./practiceMethods";

afterEach(cleanup);

describe("PracticeMethods", () => {
    it("names every method with its dose", () => {
        render(<PracticeMethods />);
        expect(screen.getByRole("heading", { name: m.methods_title() })).toBeTruthy();
        expect(screen.getAllByRole("listitem")).toHaveLength(METHODS.length);
        expect(screen.getByText(m.method_chunking_name())).toBeTruthy();
        expect(screen.getByText(m.methods_dose({ count: 15 }))).toBeTruthy();
    });

    it("offers nothing to press", () => {
        render(<PracticeMethods />);
        // Three of the six are done with a control inside a run, so a button could only
        // land on a catalogue — the reading is the whole of it.
        expect(screen.queryAllByRole("link")).toHaveLength(0);
        expect(screen.queryAllByRole("button")).toHaveLength(0);
    });
});
