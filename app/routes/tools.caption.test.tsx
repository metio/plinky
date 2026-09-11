// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { baseLocale, overwriteGetLocale } from "../paraglide/runtime.js";
import { renderWithServices } from "../testing/renderWithServices";
import ToolsRoute from "./tools";

// The caption is drawn into the saved picture, so the button stands in for it here and
// shows the caption it was handed.
vi.mock("../components/features/savePictureButton", () => ({
    SavePictureButton: ({ caption }: { caption: string }) => <p>{`caption: ${caption}`}</p>,
}));

afterEach(() => {
    cleanup();
    overwriteGetLocale(() => baseLocale);
});

const captions = () => screen.getAllByText(/^caption: /).map((el) => el.textContent ?? "");

describe("the tools page's picture captions", () => {
    it("space a scale's root from its name as a chord's are spaced", () => {
        renderWithServices(<ToolsRoute />);
        expect(captions().length).toBeGreaterThanOrEqual(2);
        for (const caption of captions()) {
            expect(caption).toMatch(/^caption: C /);
        }
    });

    it("run the root into the name in Japanese, for a scale as for a chord", () => {
        overwriteGetLocale(() => "ja");
        renderWithServices(<ToolsRoute />);
        expect(captions().length).toBeGreaterThanOrEqual(2);
        for (const caption of captions()) {
            expect(caption).toMatch(/^caption: C\S/);
        }
    });
});
