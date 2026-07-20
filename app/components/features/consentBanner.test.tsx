// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { memoryStore } from "../../adapters/memoryStore";
import { m } from "../../paraglide/messages.js";
import { createPrefsStore } from "../../stores/prefsStore";
import { renderWithServices } from "../../testing/renderWithServices";
import { ConsentBanner } from "./consentBanner";

afterEach(cleanup);

const mount = () =>
    renderWithServices(
        <MemoryRouter>
            <ConsentBanner />
        </MemoryRouter>,
    );

describe("ConsentBanner", () => {
    it("shows until a choice is made, then records consent on accept", () => {
        const { services } = mount();
        expect(services.prefs.load().analyticsAsked).toBe(false);
        fireEvent.click(screen.getByRole("button", { name: m.consent_accept() }));
        const prefs = services.prefs.load();
        expect(prefs.analyticsConsent).toBe(true);
        expect(prefs.analyticsAsked).toBe(true);
        // Answered, so it's gone.
        expect(screen.queryByRole("button", { name: m.consent_accept() })).toBeNull();
    });

    it("records a refusal on decline, leaving analytics off", () => {
        const { services } = mount();
        fireEvent.click(screen.getByRole("button", { name: m.consent_decline() }));
        const prefs = services.prefs.load();
        expect(prefs.analyticsConsent).toBe(false);
        expect(prefs.analyticsAsked).toBe(true);
    });

    it("does not show once a choice has already been made", () => {
        // A prefs store that already carries an answered consent: the banner stays hidden.
        const prefs = createPrefsStore(memoryStore());
        prefs.save({ ...prefs.load(), analyticsAsked: true });
        renderWithServices(
            <MemoryRouter>
                <ConsentBanner />
            </MemoryRouter>,
            { prefs },
        );
        expect(screen.queryByRole("button", { name: m.consent_accept() })).toBeNull();
    });
});
