// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { m } from "../../paraglide/messages.js";
import { SurpriseButton } from "./surpriseButton";

afterEach(cleanup);

describe("SurpriseButton", () => {
    it("invites a pick and fires the handler on press", () => {
        const onClick = vi.fn();
        render(<SurpriseButton onClick={onClick} />);
        fireEvent.click(screen.getByRole("button", { name: m.surprise_me() }));
        expect(onClick).toHaveBeenCalledOnce();
    });
});
