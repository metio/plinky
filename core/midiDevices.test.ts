// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { type ConnectedInput, diffConnectedInputs } from "./midiDevices";

const connected = (id: string, name: string): ConnectedInput => ({ id, name, state: "connected" });

describe("diffConnectedInputs", () => {
    it("reports the currently-connected inputs keyed by id", () => {
        const { nowConnected } = diffConnectedInputs(
            new Map(),
            [connected("a", "Piano"), connected("b", "Pad")],
        );
        expect([...nowConnected]).toEqual([
            ["a", "Piano"],
            ["b", "Pad"],
        ]);
    });

    it("names a device that has vanished from the list as dropped", () => {
        const previous = new Map([["a", "Piano"]]);
        const { droppedNames } = diffConnectedInputs(previous, []);
        expect([...droppedNames]).toEqual(["Piano"]);
    });

    it("names a device that flipped to disconnected as dropped", () => {
        const previous = new Map([["a", "Piano"]]);
        const { nowConnected, droppedNames } = diffConnectedInputs(previous, [
            { id: "a", name: "Piano", state: "disconnected" },
        ]);
        expect(nowConnected.has("a")).toBe(false);
        expect([...droppedNames]).toEqual(["Piano"]);
    });

    it("drops only the vanished device, never a sibling still connected", () => {
        const previous = new Map([
            ["a", "Piano"],
            ["b", "Pad"],
        ]);
        const { nowConnected, droppedNames } = diffConnectedInputs(previous, [connected("a", "Piano")]);
        expect(nowConnected.has("a")).toBe(true);
        expect([...droppedNames]).toEqual(["Pad"]);
    });

    it("reports nothing dropped when the set is unchanged", () => {
        const previous = new Map([["a", "Piano"]]);
        const { droppedNames } = diffConnectedInputs(previous, [connected("a", "Piano")]);
        expect(droppedNames.size).toBe(0);
    });

    it("does not treat a freshly-plugged device as a drop", () => {
        const { droppedNames } = diffConnectedInputs(new Map(), [connected("a", "Piano")]);
        expect(droppedNames.size).toBe(0);
    });
});
