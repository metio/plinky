// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The analytics capability: turn anonymous usage analytics on or off. The real
// adapter loads Google Analytics on the first opt-in and stops sending when off; a
// fake records the calls. Nothing loads or is sent until `setConsent(true)`, which
// only ever follows a deliberate Settings opt-in — there is no first-visit banner
// and no default-on path.
export type Analytics = {
    setConsent(on: boolean): void;
};
