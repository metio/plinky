// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// A single MIDI input as the connection reports it: a stable id, the device name a held
// note is stamped with, and whether it is currently connected.
export type ConnectedInput = {
    id: string;
    name: string;
    state: "connected" | "disconnected";
};

// Compare the inputs seen connected on the previous refresh with the current list, and
// report which are connected now and which device NAMES have dropped — an input that was
// connected is gone from the list, or has flipped to "disconnected". A dropped device
// never sends the note-offs for whatever it was holding, so the caller releases its held
// notes; scoping the drop to that device's name is what keeps a sibling device that is
// still live from having its own held notes cut short when a neighbour is unplugged.
export function diffConnectedInputs(
    previous: ReadonlyMap<string, string>,
    current: readonly ConnectedInput[],
): { nowConnected: Map<string, string>; droppedNames: Set<string> } {
    const nowConnected = new Map<string, string>();
    for (const input of current) {
        if (input.state === "connected") {
            nowConnected.set(input.id, input.name);
        }
    }
    const droppedNames = new Set<string>();
    for (const [id, name] of previous) {
        if (!nowConnected.has(id)) {
            droppedNames.add(name);
        }
    }
    return { nowConnected, droppedNames };
}
