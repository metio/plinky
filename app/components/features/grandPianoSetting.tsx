// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSyncExternalStore } from "react";
import { sampleCredit, samplesEnabled } from "../../../core/sampledPiano";
import { usePersistence, useSampleSource } from "../../contexts/services";
import { NO_SAMPLES, type SampleState } from "../../ports/sampleSource";
import { Button } from "../ui/button";
import { ConfirmButton } from "../ui/confirmButton";
import { SwitchField } from "../ui/fields";
import { m } from "../../paraglide/messages.js";

// What this panel can say before it knows the device: the choice at its default, and
// nothing fetched.
//
// The static document is one file every device opens, so it may not carry a figure that
// belongs to any single one of them — and the machine that prerenders it has a sample
// source of its own, which will happily have fetched a manifest by the time the page is
// written. Server render and first hydration both read this constant instead, so the
// document and every first client render agree; the subscription reports what this device
// actually holds on the render straight after, like the rest of the stored state on this
// page.
//
// `enabled` is the stored default rather than `false`, read from the one function that
// decides it, so the switch in the static document is already in the position a device
// that has never touched it will find it in.
const BEFORE_ANY_DEVICE: SampleState = { ...NO_SAMPLES, enabled: samplesEnabled(null) };

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
    const persistence = usePersistence();
    const state = useSyncExternalStore(
        samples.subscribe,
        () => samples.state(),
        () => BEFORE_ANY_DEVICE,
    );
    // Through the subscription for the same reason the figures are: read straight off the
    // source, the credit is whatever the renderer happened to have fetched, which on the
    // prerender is a line no first paint anywhere can match.
    const manifest = useSyncExternalStore(
        samples.subscribe,
        () => samples.manifest(),
        () => null,
    );
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
                <div className="space-y-2">
                    <p className="text-xs text-muted">
                        {/* "Fetching" only while something is actually being fetched. It used
                            to stand for "no manifest yet", which on a revisit meant it sat
                            there describing work nobody had started. */}
                        {manifest
                            ? sampleCredit(manifest)
                            : state.loading
                              ? m.settings_grand_piano_arriving()
                              : m.settings_grand_piano_offline()}
                    </p>
                    {/* What the device actually holds, which is the question the switch alone
                        cannot answer: a player who cannot hear the difference has no way to
                        tell a recorded piano that is working from one that quietly never
                        arrived. Held is of the whole pack, because "142 recordings" on its
                        own says nothing about whether that is most of it or barely a start.
                        Ready is this session, and the two differing is not a fault — the
                        cache survives the tab and the decoded audio does not. */}
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <dt className="text-muted">{m.settings_grand_piano_on_device()}</dt>
                        <dd className="text-right tabular-nums text-body">
                            {state.wanted > 0
                                ? m.settings_grand_piano_of_pack({
                                      held: state.held,
                                      total: state.wanted,
                                  })
                                : state.held}
                        </dd>
                        <dt className="text-muted">{m.settings_grand_piano_ready()}</dt>
                        <dd className="text-right tabular-nums text-body">{state.ready}</dd>
                    </dl>
                    {/* The two figures count different things and the second one used to
                        read as a fault: a device holding all 637 recordings still showed
                        "43 ready", which sounds like 594 of them failed. They did not — a
                        recording is decoded when a piece asks for it, and decoded audio
                        does not outlive the tab while the cache does. Saying so is cheaper
                        than the panel being right and unbelievable. */}
                    <p className="text-xs text-muted">{m.settings_grand_piano_ready_hint()}</p>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            onClick={() => {
                                // Not awaited, like the switch: the figures above move as it
                                // goes, which is the progress bar.
                                // Eighty-five megabytes makes this origin a fatter
                                // target for eviction, so ask to be kept before
                                // asking for the bytes.
                                void persistence.ensure().then(() => samples.fetchAll());
                            }}
                            disabled={
                                state.loading || (state.wanted > 0 && state.held >= state.wanted)
                            }
                        >
                            {state.loading
                                ? m.settings_grand_piano_fetching()
                                : m.settings_grand_piano_fetch_all()}
                        </Button>
                        <ConfirmButton
                            confirmLabel={m.settings_grand_piano_clear_yes()}
                            onConfirm={() => {
                                void samples.clear();
                            }}
                            disabled={state.held === 0}
                        >
                            {m.settings_grand_piano_clear()}
                        </ConfirmButton>
                    </div>
                    <p className="text-xs text-muted">{m.settings_grand_piano_fetch_all_help()}</p>
                </div>
            )}
        </div>
    );
}
