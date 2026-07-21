// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Analytics, AnalyticsParams } from "../ports/analytics";

// One recorded usage event, for a test to assert against.
export type FakeEvent = { event: string; params: AnalyticsParams };

// A fake analytics capability for tests and the browser suite: records the consent
// it was told and the events it was asked to track, and never touches the DOM or the
// network. `consented` reads the last consent state; `events` lists the tracked
// events — recorded raw (consent gating is the real adapter's job), so a test can
// assert exactly what a flow would send. Nothing here loads Google Analytics.
export function fakeAnalytics(): Analytics & {
    consented: () => boolean;
    calls: () => boolean[];
    events: () => FakeEvent[];
} {
    const calls: boolean[] = [];
    const events: FakeEvent[] = [];
    return {
        setConsent(on) {
            calls.push(on);
        },
        track(event, params = {}) {
            events.push({ event, params });
        },
        consented: () => calls.at(-1) ?? false,
        calls: () => [...calls],
        events: () => [...events],
    };
}
