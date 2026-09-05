// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAsyncEffect } from "./useAsyncEffect";

describe("useAsyncEffect", () => {
    it("says a run is alive until its dependencies change, then no longer", () => {
        const runs: { id: number; alive: () => boolean }[] = [];
        const view = renderHook(
            ({ id }: { id: number }) =>
                useAsyncEffect(
                    (alive) => {
                        runs.push({ id, alive });
                        return undefined;
                    },
                    [id],
                ),
            { initialProps: { id: 1 } },
        );
        expect(runs.map((run) => [run.id, run.alive()])).toEqual([[1, true]]);
        view.rerender({ id: 2 });
        expect(runs.map((run) => [run.id, run.alive()])).toEqual([
            [1, false],
            [2, true],
        ]);
    });

    it("marks the run dead on unmount, and runs the effect's own cleanup after", () => {
        const order: string[] = [];
        let alive: () => boolean = () => true;
        const view = renderHook(() =>
            useAsyncEffect((isAlive) => {
                alive = isAlive;
                return () => {
                    order.push(`cleanup alive=${isAlive()}`);
                };
            }, []),
        );
        expect(alive()).toBe(true);
        view.unmount();
        expect(alive()).toBe(false);
        expect(order).toEqual(["cleanup alive=false"]);
    });

    it("keeps a setter after an await from writing into a component that has moved on", async () => {
        const wrote = vi.fn();
        let release: () => void = () => {};
        const view = renderHook(
            ({ id }: { id: number }) =>
                useAsyncEffect(
                    (alive) => {
                        new Promise<void>((resolve) => {
                            release = resolve;
                        }).then(() => {
                            if (alive()) {
                                wrote(id);
                            }
                        });
                        return undefined;
                    },
                    [id],
                ),
            { initialProps: { id: 1 } },
        );
        const first = release;
        view.rerender({ id: 2 });
        await act(async () => {
            first();
            await Promise.resolve();
        });
        expect(wrote).not.toHaveBeenCalledWith(1);
    });
});
