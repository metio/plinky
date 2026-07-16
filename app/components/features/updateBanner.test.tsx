// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UpdateBanner } from "./updateBanner";
import { m } from "../../paraglide/messages.js";

afterEach(cleanup);

describe("UpdateBanner", () => {
    it("renders nothing until an update is ready", () => {
        render(<UpdateBanner updateReady={false} onReload={() => {}} />);
        expect(screen.queryByRole("status")).toBeNull();
    });

    it("announces the new version when one is ready", () => {
        render(<UpdateBanner updateReady={true} onReload={() => {}} />);
        expect(screen.getByRole("status").textContent).toContain(m.update_available());
    });

    it("applies the update on Reload", () => {
        const onReload = vi.fn();
        render(<UpdateBanner updateReady={true} onReload={onReload} />);
        fireEvent.click(screen.getByRole("button", { name: "Reload" }));
        expect(onReload).toHaveBeenCalledOnce();
    });

    it("warns when updates can't be installed on this device", () => {
        render(<UpdateBanner updateReady={false} updateBroken={true} onReload={() => {}} />);
        expect(screen.getByRole("status").textContent).toContain("Updates can’t be installed");
        // The broken notice offers no reload — there is nothing to apply.
        expect(screen.queryByRole("button", { name: "Reload" })).toBeNull();
    });

    it("prefers a ready update over the broken notice", () => {
        // Both at once cannot really happen (a failed registration never parks a
        // build), but the ready offer is the actionable one either way.
        render(<UpdateBanner updateReady={true} updateBroken={true} onReload={() => {}} />);
        expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
    });

    it("dismisses the broken notice on ✕ for this page load", () => {
        const { rerender } = render(
            <UpdateBanner updateReady={false} updateBroken={true} onReload={() => {}} />,
        );
        fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
        expect(screen.queryByRole("status")).toBeNull();
        rerender(<UpdateBanner updateReady={false} updateBroken={true} onReload={() => {}} />);
        expect(screen.queryByRole("status")).toBeNull();
    });

    it("dismisses on ✕ and stays dismissed for this page load", () => {
        const { rerender } = render(<UpdateBanner updateReady={true} onReload={() => {}} />);
        fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
        expect(screen.queryByRole("status")).toBeNull();
        // A later render with the update still pending does not resurrect it.
        rerender(<UpdateBanner updateReady={true} onReload={() => {}} />);
        expect(screen.queryByRole("status")).toBeNull();
    });
});
