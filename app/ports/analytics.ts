// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The parameters carried by a tracked event. GA4 event params are scalar, so this
// stays flat — no nested objects. Nothing here is user-specific: only which controls,
// modes and features are being used, never who used them.
export type AnalyticsParams = Record<string, string | number | boolean>;

// The analytics capability: turn anonymous usage analytics on or off, and record a
// usage event. The real adapter loads Google Analytics on the first opt-in and stops
// sending when off; a fake records the calls. Nothing loads or is sent until
// `setConsent(true)`, which only ever follows a deliberate consent — the first-visit
// banner or the Settings toggle. Never default-on; `track` is a no-op until then.
export type Analytics = {
    setConsent(on: boolean): void;
    // Record an anonymous usage event. Dropped unless consent is granted and the tag
    // has loaded, so a call before opt-in (or where no measurement id is built in)
    // sends nothing.
    track(event: string, params?: AnalyticsParams): void;
};
