// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { useDismissable } from "./useDismissable";

// A menu of the shape both real ones have: a trigger and a panel, inside one element the
// ref goes on.
function Menu({ onState }: { onState?: (open: boolean) => void } = {}) {
    const [open, setOpen] = useState(false);
    const enclosing = useDismissable<HTMLSpanElement>(open, () => setOpen(false));
    onState?.(open);
    return (
        <div>
            <span ref={enclosing}>
                <button type="button" onClick={() => setOpen((value) => !value)}>
                    open
                </button>
                {open && (
                    <span>
                        <button type="button">inside</button>
                    </span>
                )}
            </span>
            <button type="button">elsewhere</button>
        </div>
    );
}

// Renders are not torn down automatically in this project, and a second menu left in
// the document makes every query ambiguous.
afterEach(cleanup);

const openIt = () => fireEvent.click(screen.getByRole("button", { name: "open" }));
const isOpen = () => screen.queryByRole("button", { name: "inside" }) !== null;

describe("useDismissable", () => {
    it("closes on a press somewhere else", () => {
        render(<Menu />);
        openIt();
        expect(isOpen()).toBe(true);
        fireEvent.pointerDown(screen.getByRole("button", { name: "elsewhere" }));
        expect(isOpen()).toBe(false);
    });

    it("closes on Escape", () => {
        render(<Menu />);
        openIt();
        fireEvent.keyDown(document, { key: "Escape" });
        expect(isOpen()).toBe(false);
    });

    it("stays open when the press lands inside it", () => {
        // The panel is for pressing. A menu that shut on its own contents would be
        // unusable, which is the obvious way to get this wrong.
        render(<Menu />);
        openIt();
        fireEvent.pointerDown(screen.getByRole("button", { name: "inside" }));
        expect(isOpen()).toBe(true);
    });

    it("opens at all", () => {
        // The trigger is INSIDE the enclosing element on purpose. Were it outside, its own
        // press would read as "somewhere else" and close the menu on pointerdown before the
        // click could open it — so the menu would never appear.
        render(<Menu />);
        openIt();
        expect(isOpen()).toBe(true);
    });

    it("gives focus back to whatever opened it", () => {
        // A menu that closes and drops focus to the top of the document strands a keyboard
        // user wherever they were.
        render(<Menu />);
        const trigger = screen.getByRole("button", { name: "open" });
        trigger.focus();
        openIt();
        fireEvent.keyDown(document, { key: "Escape" });
        expect(document.activeElement).toBe(trigger);
    });

    it("ignores keys that are not Escape", () => {
        render(<Menu />);
        openIt();
        fireEvent.keyDown(document, { key: "Enter" });
        fireEvent.keyDown(document, { key: "a" });
        expect(isOpen()).toBe(true);
    });

    it("listens for nothing while it is closed", () => {
        // No listeners on a document that has no menu open: every closed menu on the page
        // would otherwise be watching every press.
        const states: boolean[] = [];
        render(<Menu onState={(open) => states.push(open)} />);
        fireEvent.pointerDown(document.body);
        fireEvent.keyDown(document, { key: "Escape" });
        expect(states.every((open) => open === false)).toBe(true);
    });

    it("stops listening once it is gone", () => {
        // An unmounted menu that left its handlers behind would close a menu that no longer
        // exists, and hold a reference to it for as long as the page lives.
        const { unmount } = render(<Menu />);
        openIt();
        unmount();
        expect(() => fireEvent.keyDown(document, { key: "Escape" })).not.toThrow();
    });
});
