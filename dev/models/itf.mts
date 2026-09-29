// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Replaying a Quint model's traces against the real implementation.
//
// Quint checks a model, and it cannot run TypeScript — so the only way a model says
// anything about the app is to make it produce traces and drive the real code from them.
// `quint run --mbt --out-itf` writes each run as ITF, an interchange format that records
// every state plus the action that produced it and the values it picked. What is left is
// the same three jobs every time: decode ITF, dispatch each action at the real system,
// and compare the state after it. This does all three, so a new model costs a `.qnt` file
// and an adapter naming which call each action makes — not a driver of its own.
//
// The traces are committed rather than generated during a test run: replaying them needs
// no Quint, so the gate stays a plain vitest file, and a trace is a reviewable artifact
// that says exactly which interleavings were checked. `npm run models` regenerates them.

// ITF writes an integer as {"#bigint": "60"}, a set as {"#set": […]}, a map as
// {"#map": [[k, v], …]} and a tuple as {"#tup": […]}, so every value needs unwrapping
// before it can be compared with anything real.
export function itfValue(raw: unknown): unknown {
    if (Array.isArray(raw)) {
        return raw.map(itfValue);
    }
    if (raw === null || typeof raw !== "object") {
        return raw;
    }
    const tagged = raw as Record<string, unknown>;
    if ("#bigint" in tagged) {
        return Number(tagged["#bigint"]);
    }
    if ("#set" in tagged) {
        return new Set((tagged["#set"] as unknown[]).map(itfValue));
    }
    if ("#map" in tagged) {
        return new Map(
            (tagged["#map"] as [unknown, unknown][]).map(([key, value]) => [
                itfValue(key),
                itfValue(value),
            ]),
        );
    }
    if ("#tup" in tagged) {
        return (tagged["#tup"] as unknown[]).map(itfValue);
    }
    return Object.fromEntries(Object.entries(tagged).map(([key, value]) => [key, itfValue(value)]));
}

// The values a nondeterministic choice landed on for one step. Quint wraps each in an
// option, and a pick belonging to a different action of the same step reads as None.
export type Picks = Record<string, unknown>;

function picksOf(raw: unknown): Picks {
    if (raw === null || typeof raw !== "object") {
        return {};
    }
    const picks: Picks = {};
    for (const [name, option] of Object.entries(raw as Record<string, unknown>)) {
        const tagged = option as { tag?: string; value?: unknown };
        if (tagged?.tag === "Some") {
            picks[name] = itfValue(tagged.value);
        }
    }
    return picks;
}

// One step of a trace: the action the model took, what it picked, and the state it
// reached — the state being the model's own variables, decoded.
export type ModelStep = {
    at: number;
    action: string;
    picks: Picks;
    state: Record<string, unknown>;
};

export type Trace = { name: string; steps: ModelStep[] };

const ACTION = "mbt::actionTaken";
const PICKS = "mbt::nondetPicks";

export function traceOf(name: string, json: string): Trace {
    const raw = JSON.parse(json) as { states?: Record<string, unknown>[] };
    const states = raw.states ?? [];
    return {
        name,
        steps: states.map((state, at) => ({
            at,
            action: String(state[ACTION] ?? "init"),
            picks: picksOf(state[PICKS]),
            state: Object.fromEntries(
                Object.entries(state)
                    .filter(([key]) => key !== ACTION && key !== PICKS && key !== "#meta")
                    .map(([key, value]) => [key, itfValue(value)]),
            ),
        })),
    };
}

// Every trace in a directory, in name order so a failure is reproducible.
export function tracesIn(dir: string): Trace[] {
    return readdirSync(dir)
        .filter((file) => file.endsWith(".itf.json"))
        .sort()
        .map((file) => traceOf(file, readFileSync(join(dir, file), "utf8")));
}

// What a model needs to say about the real thing: how to build one, what each of the
// model's actions does to it, and how to tell whether it agrees with the model's state.
export type Replay<System> = {
    start(): System;
    // One entry per action in the model. An action with no entry fails the replay rather
    // than passing quietly — a model that grew a case the real system never sees would
    // otherwise look verified.
    actions: Record<string, (system: System, picks: Picks) => void>;
    // Throw (an expect() failure will do) when the real system and the model disagree.
    agrees(system: System, state: Record<string, unknown>): void;
};

// Drives one trace. A mismatch is reported with the step, the action and its picks,
// because a bare assertion failure in the middle of a generated interleaving says
// nothing about how the system got there.
export function replay<System>(trace: Trace, spec: Replay<System>): void {
    const system = spec.start();
    for (const step of trace.steps) {
        if (step.at > 0) {
            const act = spec.actions[step.action];
            if (!act) {
                throw new Error(
                    `${trace.name} step ${step.at}: the model took "${step.action}", which this replay does not know how to perform`,
                );
            }
            act(system, step.picks);
        }
        try {
            spec.agrees(system, step.state);
        } catch (cause) {
            const picks = Object.entries(step.picks)
                .map(([name, value]) => `${name}=${String(value)}`)
                .join(" ");
            throw new Error(
                `${trace.name} step ${step.at}: after ${step.action}${picks ? ` (${picks})` : ""}, the system and the model disagree\n${
                    cause instanceof Error ? cause.message : String(cause)
                }`,
                { cause },
            );
        }
    }
}
