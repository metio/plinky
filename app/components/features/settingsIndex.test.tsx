// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { m } from "../../paraglide/messages.js";
import { SettingsIndex } from "./settingsIndex";

afterEach(cleanup);

const GROUPS = [
    {
        label: "Your instrument",
        items: [
            { anchor: "midi", title: "Connect MIDI" },
            { anchor: "sound", title: "Sound" },
        ],
    },
    { label: "Learning", items: [{ anchor: "grades", title: "Grades" }] },
];

describe("SettingsIndex", () => {
    it("lists every section under its group as a link to its anchor", () => {
        render(<SettingsIndex groups={GROUPS} current="" />);
        const nav = screen.getByRole("navigation", { name: m.settings_index_label() });
        expect(nav).toBeTruthy();
        expect(screen.getByRole("list", { name: "Your instrument" })).toBeTruthy();
        expect(screen.getByRole("link", { name: "Grades" }).getAttribute("href")).toBe("#grades");
        expect(screen.getAllByRole("link")).toHaveLength(3);
    });

    it("marks the section the address names as where the reader is", () => {
        render(<SettingsIndex groups={GROUPS} current="sound" />);
        expect(screen.getByRole("link", { name: "Sound" }).getAttribute("aria-current")).toBe(
            "location",
        );
        expect(
            screen.getByRole("link", { name: "Grades" }).getAttribute("aria-current"),
        ).toBeNull();
    });
});
