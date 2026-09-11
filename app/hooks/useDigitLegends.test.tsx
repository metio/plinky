// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { EarDigitHint } from "../components/features/earDigitHint";
import { ServicesProvider } from "../contexts/services";
import { createKeyboardEvidence } from "../lib/keyboardEvidence";
import { m } from "../paraglide/messages.js";
import { renderWithServices } from "../testing/renderWithServices";

afterEach(cleanup);

// A session that has already seen a key on a keyboard of the player's own.
const typedOn = () => {
    const evidence = createKeyboardEvidence();
    evidence.note();
    return evidence;
};

describe("useDigitLegends", () => {
    it("prerenders no legend, whatever the session has seen, so hydration starts from what the server sent", () => {
        // The prerendered page cannot know the device, and the first client render must match
        // it: a legend there and not in the static document would be a hydration mismatch.
        const html = renderToString(
            <ServicesProvider services={{ keyboardEvidence: typedOn() }}>
                <EarDigitHint shown={true} />
            </ServicesProvider>,
        );
        expect(html).not.toContain(m.ear_digit_hint());
    });

    it("shows the legend once mounted on a session that has seen a key", () => {
        // The same evidence on the client: what the server left out is the server's doing.
        renderWithServices(<EarDigitHint shown={true} />, { keyboardEvidence: typedOn() });
        expect(screen.getByText(m.ear_digit_hint())).toBeTruthy();
    });
});
