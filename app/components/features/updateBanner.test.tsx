// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UpdateBanner } from "./updateBanner";

afterEach(cleanup);

describe("UpdateBanner", () => {
    it("renders nothing until an update is ready", () => {
        render(<UpdateBanner updateReady={false} onReload={() => {}} />);
        expect(screen.queryByRole("status")).toBeNull();
    });

    it("announces the new version when one is ready", () => {
        render(<UpdateBanner updateReady={true} onReload={() => {}} />);
        expect(screen.getByRole("status").textContent).toContain("new version");
    });

    it("applies the update on Reload", () => {
        const onReload = vi.fn();
        render(<UpdateBanner updateReady={true} onReload={onReload} />);
        fireEvent.click(screen.getByRole("button", { name: "Reload" }));
        expect(onReload).toHaveBeenCalledOnce();
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
