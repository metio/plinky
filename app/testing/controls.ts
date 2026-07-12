// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { fireEvent, screen, within } from "@testing-library/react";

// Locale-proof selection and assertion helpers for the app's shared controls
// (SwitchField/Switch, ChoiceField/SegmentedControl, ToggleIconButton). Pass the
// paraglide message function the component renders — `toggle(m.settings_play_sounds)`
// — so a test asks for whatever the app currently says instead of hardcoding
// copy; a reworded or retranslated label can never strand a selector. Every
// helper resolves through ARIA roles, so the accessible contract is asserted for
// free on the way.

type Label = string | (() => string);

const text = (label: Label) => (typeof label === "function" ? label() : label);

// The switch with this accessible name — SwitchField and the bare Switch alike.
function switchByLabel(label: Label): HTMLElement {
    return screen.getByRole("switch", { name: text(label) });
}

// Flip a boolean setting.
export function toggle(label: Label): void {
    fireEvent.click(switchByLabel(label));
}

// Whether a boolean setting is currently on.
export function switchOn(label: Label): boolean {
    return switchByLabel(label).getAttribute("aria-checked") === "true";
}

// Pick one option of an enumerated setting (a ChoiceField / SegmentedControl).
export function choose(field: Label, option: Label): void {
    const control = screen.getByRole("tablist", { name: text(field) });
    fireEvent.click(within(control).getByRole("tab", { name: text(option) }));
}

// The visible label of the option an enumerated setting has selected.
export function chosen(field: Label): string | null {
    const control = screen.getByRole("tablist", { name: text(field) });
    const selected = within(control)
        .getAllByRole("tab")
        .find((tab) => tab.getAttribute("aria-selected") === "true");
    return selected?.textContent ?? null;
}

// Whether a press-state icon button (ToggleIconButton) is currently pressed.
export function pressed(label: Label): boolean {
    return (
        screen.getByRole("button", { name: text(label) }).getAttribute("aria-pressed") === "true"
    );
}
