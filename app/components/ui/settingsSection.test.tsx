// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SettingsSection } from "./settingsSection";

afterEach(cleanup);

describe("SettingsSection", () => {
    it("renders an h2 by default and the children below it", () => {
        render(
            <SettingsSection title="Sound">
                <p>controls</p>
            </SettingsSection>,
        );
        expect(screen.getByRole("heading", { level: 2, name: "Sound" })).toBeTruthy();
        expect(screen.getByText("controls")).toBeTruthy();
    });

    it("renders as a card with its icon and hint when given an icon", () => {
        render(
            <SettingsSection title="Sound" hint="Plinky can play notes" icon={<svg role="img" />}>
                <p>controls</p>
            </SettingsSection>,
        );
        expect(screen.getByRole("heading", { level: 2, name: "Sound" })).toBeTruthy();
        expect(screen.getByText("Plinky can play notes")).toBeTruthy();
    });

    it("renders an h3 with its hint for a nested panel", () => {
        render(
            <SettingsSection title="Hand size" hint="Measure each hand" level={3}>
                <p>controls</p>
            </SettingsSection>,
        );
        expect(screen.getByRole("heading", { level: 3, name: "Hand size" })).toBeTruthy();
        expect(screen.getByText("Measure each hand")).toBeTruthy();
    });
});
