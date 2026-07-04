// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MidiDevice } from "../../../core/midi";
import { MidiBadge } from "./midiBadge";

const { connectionMock } = vi.hoisted(() => ({ connectionMock: vi.fn() }));
vi.mock("../../contexts/midi", () => ({ useMidiConnection: connectionMock }));

const device: MidiDevice = { id: "1", name: "Piano", manufacturer: "", state: "connected" };

function setConnection(value: { support: string; status: string; devices: MidiDevice[] }) {
    connectionMock.mockReturnValue(value);
}

afterEach(cleanup);

describe("MidiBadge", () => {
    it("shows a connected badge when a device is ready", () => {
        setConnection({ support: "supported", status: "ready", devices: [device] });
        render(<MidiBadge />);
        expect(screen.getByRole("img", { name: /connected/i })).toBeTruthy();
    });

    it("shows the gentle disconnected badge when supported but no device", () => {
        setConnection({ support: "supported", status: "idle", devices: [] });
        render(<MidiBadge />);
        expect(screen.getByRole("img", { name: /No piano connected/i })).toBeTruthy();
    });

    it("treats ready-with-no-inputs as not connected", () => {
        setConnection({ support: "supported", status: "ready", devices: [] });
        render(<MidiBadge />);
        expect(screen.getByRole("img", { name: /No piano connected/i })).toBeTruthy();
    });

    it("renders nothing where Web MIDI is unsupported (Safari, iOS)", () => {
        setConnection({ support: "unsupported", status: "idle", devices: [] });
        const { container } = render(<MidiBadge />);
        expect(container.firstChild).toBeNull();
    });
});
