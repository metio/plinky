// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { type AidPrefs, levelAids } from "../../../core/readingLevel";
import { m } from "../../paraglide/messages.js";
import { choose, chosen } from "../../testing/controls";
import { renderWithServices } from "../../testing/renderWithServices";
import { ReadingLevel } from "./readingLevel";

afterEach(cleanup);

describe("ReadingLevel", () => {
    it("applies every aid of the picked level and marks it selected", () => {
        const { services } = renderWithServices(<ReadingLevel />);
        choose(m.reading_level_label, m.reading_level_sight_reader);
        expect(chosen(m.reading_level_label)).toBe(m.reading_level_sight_reader());
        const prefs = services.prefs.load();
        for (const [key, value] of Object.entries(levelAids("sightReader"))) {
            expect(prefs[key as keyof AidPrefs]).toBe(value);
        }
    });

    it("leaves personal prefs untouched when a level is applied", () => {
        const { services } = renderWithServices(<ReadingLevel />);
        services.prefs.save({ ...services.prefs.load(), volume: 33, sound: false });
        choose(m.reading_level_label, m.reading_level_starter);
        const prefs = services.prefs.load();
        expect(prefs.volume).toBe(33);
        expect(prefs.sound).toBe(false);
        expect(prefs.highway).toBe(true); // the aid did change
    });

    it("shows a real level on a device that has changed nothing", () => {
        // The shipped defaults are exactly the starter rung, so a reader who has touched
        // no setting is told where they are rather than "Custom".
        renderWithServices(<ReadingLevel />);
        expect(chosen(m.reading_level_label)).toBe(m.reading_level_starter());
    });

    it("shows no level selected once the aids are mixed by hand", () => {
        const { services } = renderWithServices(<ReadingLevel />);
        // One aid off the starter rung and the mix matches nothing — an honest "Custom".
        act(() => {
            services.prefs.save({ ...services.prefs.load(), colorNotes: false });
        });
        expect(chosen(m.reading_level_label)).toBeNull();
    });
});
