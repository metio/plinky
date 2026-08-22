// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Ask for the engraver as soon as a page that will need it is known to be opening, rather
// than when the component that uses it finally mounts.
//
// It is the heaviest thing the app loads by a wide margin — 1.27 MB, over a second of a
// Fast 4G connection on its own — and the score component sits at the bottom of a deep tree,
// so nothing requested it until every ancestor above it had rendered. Called from a route
// module, the fetch overlaps the startup it used to queue behind: measured, the request
// moves from 3.7 s into the load to 2.6 s, and the piece appears about a second sooner.
//
// Safe to call any number of times: a module is fetched and evaluated once, and every later
// import resolves from the registry. The result is deliberately dropped — this only warms
// the cache, and the code that needs the engraver still imports it in the ordinary way and
// still reports its own failure through the score's own error path.
export function warmEngraver(): void {
    void import("opensheetmusicdisplay").catch(() => {});
}
