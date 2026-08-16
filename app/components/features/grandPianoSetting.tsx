// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSyncExternalStore } from "react";
import { sampleCredit } from "../../../core/sampledPiano";
import { useSampleSource } from "../../contexts/services";
import { SwitchField } from "../ui/fields";
import { m } from "../../paraglide/messages.js";

// The choice between the piano Plinky synthesises and a recorded one.
//
// There is no download button and no progress bar, because there is no download: the
// recordings arrive a piece at a time, a few hundred kilobytes each, and the instrument
// improves as somebody plays rather than making them wait first. Measured over the
// catalogue, a first study needs three recordings and a grade 8 piece two dozen, and a
// player who works through sixteen pieces has fetched under five megabytes in total.
//
// So the switch says what it does and then gets out of the way. What is shown underneath is
// the credit the recordings are owed — they are CC-BY, which is a condition, not a
// courtesy — and, once anything has arrived, how much of this device it is using.
export function GrandPianoSetting() {
    const samples = useSampleSource();
    const state = useSyncExternalStore(
        samples.subscribe,
        () => samples.state(),
        () => samples.state(),
    );
    const manifest = samples.manifest();
    return (
        <div className="space-y-2">
            <SwitchField
                label={m.settings_grand_piano()}
                help={m.settings_grand_piano_caption()}
                checked={state.enabled}
                onChange={(on) => {
                    // Neither direction is awaited: turning it on fetches a manifest, and
                    // turning it off empties a cache. A switch that waited on either would
                    // be a switch that sometimes did not move.
                    void (on ? samples.enable() : samples.forget());
                }}
            />
            {state.enabled && (
                <p className="text-xs text-muted">
                    {manifest ? sampleCredit(manifest) : m.settings_grand_piano_arriving()}
                    {state.bytes > 0 && (
                        <>
                            {" · "}
                            {m.settings_grand_piano_held({
                                megabytes: (state.bytes / 1_000_000).toFixed(1),
                            })}
                        </>
                    )}
                </p>
            )}
        </div>
    );
}
