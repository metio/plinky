// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { act } from "@testing-library/react";
import type { FakeScheduler } from "./fakeScheduler";

// Advance a FakeScheduler from a React test — the one safe way to drive a
// scheduler-backed timer. A timer armed inside a passive effect (the news
// carousel arms its auto-advance only once the items load asynchronously) is not
// set up until that effect flushes; driving the clock before it does crosses an
// interval that was never armed, so nothing fires and the test flakes ("expected
// null not to be null") under full-suite load. So: flush any pending effect
// first, advance the clock inside act (its callbacks touch state), then flush the
// effects the advance scheduled. Route every carousel-style advance through here
// rather than a bare `scheduler.advance`, and the flush can't be forgotten.
export async function advanceScheduler(scheduler: FakeScheduler, ms: number): Promise<void> {
    await act(async () => {});
    act(() => scheduler.advance(ms));
    await act(async () => {});
}
