// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { createEmitter } from "./emitter";

describe("createEmitter", () => {
    it("notifies every subscriber in subscription order", () => {
        const emitter = createEmitter();
        const calls: string[] = [];
        emitter.subscribe(() => calls.push("a"));
        emitter.subscribe(() => calls.push("b"));
        emitter.notify();
        expect(calls).toEqual(["a", "b"]);
    });

    it("a throwing listener does not silence its peers", () => {
        const emitter = createEmitter();
        const calls: string[] = [];
        emitter.subscribe(() => calls.push("before"));
        emitter.subscribe(() => {
            throw new Error("broken subscriber");
        });
        emitter.subscribe(() => calls.push("after"));
        expect(() => emitter.notify()).not.toThrow();
        expect(calls).toEqual(["before", "after"]);
    });

    it("unsubscribe removes exactly its own listener", () => {
        const emitter = createEmitter();
        const calls: string[] = [];
        const off = emitter.subscribe(() => calls.push("gone"));
        emitter.subscribe(() => calls.push("stays"));
        off();
        off();
        emitter.notify();
        expect(calls).toEqual(["stays"]);
    });

    it("notify walks a snapshot: mid-delivery subscriptions wait for the next notify", () => {
        const emitter = createEmitter();
        const calls: string[] = [];
        emitter.subscribe(() => {
            calls.push("first");
            emitter.subscribe(() => calls.push("late"));
        });
        emitter.notify();
        expect(calls).toEqual(["first"]);
        emitter.notify();
        expect(calls).toEqual(["first", "first", "late"]);
    });

    it("notify walks a snapshot: a listener unsubscribed mid-delivery still hears the current notify", () => {
        const emitter = createEmitter();
        const calls: string[] = [];
        let offSecond = () => {};
        emitter.subscribe(() => {
            calls.push("first");
            offSecond();
        });
        offSecond = emitter.subscribe(() => calls.push("second"));
        emitter.notify();
        expect(calls).toEqual(["first", "second"]);
        emitter.notify();
        expect(calls).toEqual(["first", "second", "first"]);
    });

    it("safely isolates a single delivery outside notify", () => {
        const emitter = createEmitter();
        expect(() =>
            emitter.safely(() => {
                throw new Error("broken");
            }),
        ).not.toThrow();
    });
});
