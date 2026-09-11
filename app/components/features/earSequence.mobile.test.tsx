// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { act, cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ChordDegree } from "../../../core/theory";
import { m } from "../../paraglide/messages.js";
import { renderWithServices } from "../../testing/renderWithServices";
import { EarSequence } from "./earSequence";

// The real-touch counterpart of the digit-legend cases in earSequence.test.tsx. There
// `(any-pointer: fine)` is stubbed; here the emulated phone answers it itself. Runs in the
// browser-mobile project (coarse touch pointer, phone viewport).

afterEach(cleanup);

const SEQUENCE: ChordDegree[] = ["I", "IV", "V", "I"];

function mount() {
    renderWithServices(
        <EarSequence
            sequence={SEQUENCE}
            choices={["I", "IV", "V"]}
            settled={false}
            onComplete={() => {}}
            label="progression"
        />,
    );
}

const badge = () => screen.getByRole("button", { name: "IV" }).querySelector("[aria-hidden]");

describe("EarSequence on a phone", () => {
    it("is a device with no fine pointer", () => {
        expect(matchMedia("(any-pointer: fine)").matches).toBe(false);
    });

    it("prints no number-key legends until a key is pressed", () => {
        mount();
        expect(badge()).toBeNull();
        expect(screen.queryByText(m.ear_digit_hint())).toBeNull();
    });

    it("prints them once a key proves a keyboard is attached", () => {
        mount();
        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "4", code: "Digit4" }));
        });
        expect(badge()?.textContent).toBe("4");
        expect(screen.getByText(m.ear_digit_hint())).toBeTruthy();
    });
});
