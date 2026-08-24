// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import UnlocalizedRedirect from "./unlocalizedRedirect";

function Landed() {
    const { pathname, search, hash } = useLocation();
    return <output>{`${pathname}${search}${hash}`}</output>;
}

const at = (entry: string) =>
    render(
        <MemoryRouter initialEntries={[entry]}>
            <Routes>
                <Route path="*" element={<UnlocalizedRedirect />} />
                <Route path="/en/*" element={<Landed />} />
            </Routes>
        </MemoryRouter>,
    );

afterEach(cleanup);

describe("UnlocalizedRedirect", () => {
    it("sends a language-less path to the visitor's own language", () => {
        at("/play/abc123");
        expect(screen.getByRole("status").textContent).toBe("/en/play/abc123/");
    });

    it("carries the query across, so a link that configures a run survives", () => {
        // The whole point: /play/<id>?speed=0.6&hands=left has to arrive with its
        // settings, or the redirect quietly drops what the link was for.
        at("/play/abc123?speed=0.6&hands=left");
        expect(screen.getByRole("status").textContent).toBe(
            "/en/play/abc123/?speed=0.6&hands=left",
        );
    });

    it("carries the fragment too", () => {
        at("/music#bottom");
        expect(screen.getByRole("status").textContent).toBe("/en/music/#bottom");
    });

    it("raises a real miss when the address already names a language", () => {
        // Only the catch-all here: in the real table a localised path that matched nothing
        // falls through to this same route. Without the split it would answer for
        // everything — the not-found page would become unreachable, and /en/nowhere would
        // redirect to itself forever.
        expect(() =>
            render(
                <MemoryRouter initialEntries={["/en/nowhere"]}>
                    <Routes>
                        <Route path="*" element={<UnlocalizedRedirect />} />
                    </Routes>
                </MemoryRouter>,
            ),
        ).toThrow();
    });
});
