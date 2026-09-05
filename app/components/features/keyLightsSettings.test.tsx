// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NOTHING_LIT, TEST_CHORD } from "../../../core/keyLights";
import { DEFAULT_PREFS, type Prefs } from "../../../core/prefs";
import { defaultChannels } from "../../../core/lightProfile";
import { fakeKeyLights } from "../../adapters/fakeKeyLights";
import { m } from "../../paraglide/messages.js";
import { choose, chosen, switchOn, toggle } from "../../testing/controls";
import { renderWithServices } from "../../testing/renderWithServices";
import { KeyLightsSettings } from "./keyLightsSettings";

afterEach(cleanup);

// The panel takes its port as a prop, so it mounts with no Web MIDI anywhere near it —
// which is the whole reason the Settings route does the wiring instead.
function mount(overrides: Partial<Prefs> = {}, deviceNames: string[] = []) {
    const lights = fakeKeyLights();
    let prefs: Prefs = { ...DEFAULT_PREFS, ...overrides };
    const panel = () => (
        <KeyLightsSettings
            prefs={prefs}
            update={update}
            keyLights={lights}
            deviceNames={deviceNames}
        />
    );
    const update = (patch: Partial<Prefs>) => {
        prefs = { ...prefs, ...patch };
        view.rerender(panel());
    };
    const view = renderWithServices(panel());
    return { lights, view, prefsNow: () => prefs };
}

describe("KeyLightsSettings", () => {
    it("shows only the switch until lighting is asked for", () => {
        mount();
        expect(switchOn(m.lights_enable)).toBe(false);
        expect(screen.queryByRole("button", { name: m.lights_test() })).toBeNull();
    });

    it("reveals the setup once it is switched on", () => {
        const { prefsNow } = mount();
        toggle(m.lights_enable);
        expect(prefsNow().keyLights).toBe(true);
        expect(screen.getByRole("button", { name: m.lights_test() })).toBeTruthy();
    });

    it("puts every light out when it is switched off", () => {
        const { lights } = mount({ keyLights: true });
        lights.show(TEST_CHORD);
        toggle(m.lights_enable);
        // Leaving the keys glowing after the feature is off would strand them until
        // something else happened to clear them.
        expect(lights.lit()).toEqual(NOTHING_LIT);
    });

    it("fills in a maker's documented channels when its profile is chosen", () => {
        const { prefsNow } = mount({ keyLights: true, lightProfile: "custom" });
        choose(m.lights_profile, m.lights_profile_yamaha);
        expect(prefsNow().lightLeftChannel).toBe(defaultChannels("yamaha").left);
        expect(prefsNow().lightRightChannel).toBe(defaultChannels("yamaha").right);
    });

    it("leaves the channels alone when the player says it is something else", () => {
        const { prefsNow } = mount({
            keyLights: true,
            lightLeftChannel: 9,
            lightRightChannel: 10,
        });
        choose(m.lights_profile, m.lights_profile_custom);
        expect(prefsNow().lightLeftChannel).toBe(9);
        expect(prefsNow().lightRightChannel).toBe(10);
    });

    it("moves off a maker's profile once a channel is edited by hand", () => {
        // The label would otherwise keep claiming Casio while the numbers say otherwise.
        const { prefsNow } = mount({ keyLights: true, lightProfile: "casio" });
        fireEvent.click(
            screen.getByRole("button", {
                name: m.lights_channel_up({ hand: m.lights_channel_left() }),
            }),
        );
        expect(prefsNow().lightLeftChannel).toBe(defaultChannels("casio").left + 1);
        expect(chosen(m.lights_profile)).toBe(m.lights_profile_custom());
    });

    it("will not step a channel outside the sixteen MIDI has", () => {
        const { prefsNow } = mount({ keyLights: true, lightRightChannel: 16 });
        const up = screen.getByRole("button", {
            name: m.lights_channel_up({ hand: m.lights_channel_right() }),
        });
        expect(up.hasAttribute("disabled")).toBe(true);
        fireEvent.click(up);
        expect(prefsNow().lightRightChannel).toBe(16);
    });

    it("puts the test chord out when the page goes away", () => {
        // The chord is lit by a button press and nothing else takes it back, so leaving
        // Settings with it showing used to strand six keys on the instrument.
        const { lights, view } = mount({ keyLights: true });
        fireEvent.click(screen.getByRole("button", { name: m.lights_test() }));
        expect(lights.lit()).toEqual(TEST_CHORD);
        view.unmount();
        expect(lights.lit()).toEqual(NOTHING_LIT);
    });

    it("lights a chord in both hands on request, and takes it back", () => {
        const { lights } = mount({ keyLights: true });
        fireEvent.click(screen.getByRole("button", { name: m.lights_test() }));
        expect(lights.lit()).toEqual(TEST_CHORD);
        fireEvent.click(screen.getByRole("button", { name: m.lights_test_off() }));
        expect(lights.lit()).toEqual(NOTHING_LIT);
    });

    it("takes the maker from the instrument's own name when lighting is switched on", () => {
        // An EZ-300 says what it is; asking somebody to pick the maker of the piano in
        // front of them is a question the app can usually answer itself.
        const { prefsNow } = mount({}, ["YAMAHA Digital Keyboard EZ-300"]);
        toggle(m.lights_enable);
        expect(prefsNow().lightProfile).toBe("yamaha");
        expect(prefsNow().lightLeftChannel).toBe(defaultChannels("yamaha").left);
    });

    it("leaves the maker alone for an instrument it does not recognise", () => {
        const { prefsNow } = mount({}, ["Some Other Piano"]);
        toggle(m.lights_enable);
        expect(prefsNow().lightProfile).toBe(DEFAULT_PREFS.lightProfile);
    });

    it("does not bump the channel readouts when an unrelated preference changes", () => {
        // Every preference change re-renders the panel; a readout handed a fresh element
        // each time read as changed each time and scaled up for nothing.
        const { view, prefsNow } = mount({ keyLights: true });
        view.rerender(
            <KeyLightsSettings
                prefs={{ ...prefsNow(), sound: !prefsNow().sound }}
                update={() => true}
                keyLights={fakeKeyLights()}
                deviceNames={[]}
            />,
        );
        expect(document.querySelector(".scale-110")).toBeNull();
    });
});
