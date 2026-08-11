// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect } from "react";
import { NOTHING_LIT, TEST_CHORD } from "../../../core/keyLights";
import {
    defaultChannels,
    LIGHT_PROFILE_IDS,
    type LightProfileId,
    MAX_CHANNEL,
    MIN_CHANNEL,
} from "../../../core/lightProfile";
import type { Prefs } from "../../../core/prefs";
import type { KeyLightsPort } from "../../ports/keyLights";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";
import { ChoiceField, SwitchField } from "../ui/fields";
import { Stepper } from "../ui/stepper";

// Setting up a keyboard that lights its own keys. It lives in Settings and nowhere
// else — a playing surface never carries MIDI configuration — and everything on it
// exists because the instrument, not the app, holds the other half of the
// arrangement: the maker's channels are changeable on the keyboard itself, and the
// lighting mode has to be switched on there ("MIDI In Navigate = Listen" on a Casio).
//
// Which is why the test button matters more than it looks. Four separate things have
// to line up before a key glows — the right output, the right channel, the keyboard's
// own lighting mode, and this switch — and without a way to try it, a player who gets
// nothing has no way to tell which one is wrong.

const PROFILE_NAME: Record<LightProfileId, () => string> = {
    casio: () => m.lights_profile_casio(),
    yamaha: () => m.lights_profile_yamaha(),
    custom: () => m.lights_profile_custom(),
};

function ChannelStepper({
    label,
    value,
    onChange,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
}) {
    return (
        <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-body">{label}</span>
            <Stepper
                value={<span className="tabular-nums">{value}</span>}
                onDecrement={() => onChange(value - 1)}
                onIncrement={() => onChange(value + 1)}
                canDecrement={value > MIN_CHANNEL}
                canIncrement={value < MAX_CHANNEL}
                decrementLabel={m.lights_channel_down({ hand: label })}
                incrementLabel={m.lights_channel_up({ hand: label })}
            />
        </div>
    );
}

export function KeyLightsSettings({
    prefs,
    update,
    // Injected rather than read from the MIDI context here: the Settings route is a
    // composition site and already holds the connection, which leaves this component
    // pure and mountable without Web MIDI.
    keyLights,
}: {
    prefs: Prefs;
    update: (patch: Partial<Prefs>) => void;
    keyLights: KeyLightsPort;
}) {
    // The test chord is lit by a button press and has nothing else to take it back, so
    // leaving Settings with it showing would strand six keys on the instrument until
    // something else happened to clear them — or forever, if the tab closes.
    useEffect(() => {
        return () => keyLights.clear();
    }, [keyLights]);

    // Choosing a maker seeds its documented channels. It does not lock them: a player
    // who has changed them on the instrument picks the maker for the convention and
    // then corrects the numbers.
    const chooseProfile = (lightProfile: LightProfileId) => {
        const channels = defaultChannels(lightProfile);
        update({
            lightProfile,
            ...(lightProfile === "custom"
                ? {}
                : { lightLeftChannel: channels.left, lightRightChannel: channels.right }),
        });
    };

    return (
        <div className="space-y-3">
            <SwitchField
                label={m.lights_enable()}
                checked={prefs.keyLights}
                onChange={(keyLightsOn) => {
                    if (!keyLightsOn) {
                        // Switching off with keys still lit would leave them glowing
                        // until something else happened to clear them.
                        keyLights.show(NOTHING_LIT);
                    }
                    update({ keyLights: keyLightsOn });
                }}
                help={m.lights_enable_help()}
            />

            {prefs.keyLights && (
                <>
                    <ChoiceField
                        label={m.lights_profile()}
                        value={prefs.lightProfile}
                        onChange={chooseProfile}
                        options={LIGHT_PROFILE_IDS.map((id) => ({
                            id,
                            label: PROFILE_NAME[id](),
                        }))}
                        help={m.lights_profile_help()}
                    />
                    <ChannelStepper
                        label={m.lights_channel_left()}
                        value={prefs.lightLeftChannel}
                        onChange={(lightLeftChannel) =>
                            update({ lightLeftChannel, lightProfile: "custom" })
                        }
                    />
                    <ChannelStepper
                        label={m.lights_channel_right()}
                        value={prefs.lightRightChannel}
                        onChange={(lightRightChannel) =>
                            update({ lightRightChannel, lightProfile: "custom" })
                        }
                    />

                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="secondary" onClick={() => keyLights.show(TEST_CHORD)}>
                            {m.lights_test()}
                        </Button>
                        <Button variant="ghost" onClick={() => keyLights.show(NOTHING_LIT)}>
                            {m.lights_test_off()}
                        </Button>
                    </div>
                    <p className="text-xs text-muted">{m.lights_test_help()}</p>
                </>
            )}
        </div>
    );
}
