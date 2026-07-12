// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { m } from "../../paraglide/messages.js";
import { PracticeToolsDrawer } from "./practiceToolsDrawer";

afterEach(cleanup);

// Every prop wired to a spy, so a test can assert exactly which edit a control reports.
const props = () => ({
    open: true,
    onClose: vi.fn(),
    lockTempo: false,
    tempo: 100,
    setTempo: vi.fn(),
    metronomeOn: false,
    setMetronomeOn: vi.fn(),
    adaptive: false,
    setAdaptive: vi.fn(),
    liveTempo: 100,
    subdivision: 1,
    setSubdivision: vi.fn(),
    forgiving: false,
    setForgiving: vi.fn(),
    noteHints: "miss" as const,
    setNoteHints: vi.fn(),
    raceGhost: true,
    setRaceGhost: vi.fn(),
    loopAvailable: true,
    loopOn: false,
    onToggleLoop: vi.fn(),
    showMineAvailable: false,
    showMine: false,
    setShowMine: vi.fn(),
    treadmill: false,
    setTreadmill: vi.fn(),
    barNumbers: false,
    setBarNumbers: vi.fn(),
    barsPerRow: 0,
    setBarsPerRow: vi.fn(),
    keyboardOctaves: 2,
    onKeyboardOctaves: vi.fn(),
});

describe("PracticeToolsDrawer", () => {
    it("reports a toggle through its setter with the new value", () => {
        const p = props();
        render(<PracticeToolsDrawer {...p} />);
        fireEvent.click(screen.getByRole("switch", { name: m.treadmill_toggle() }));
        expect(p.setTreadmill).toHaveBeenCalledWith(true);
    });

    it("reports the loop toggle only through onToggleLoop", () => {
        const p = props();
        render(<PracticeToolsDrawer {...p} />);
        fireEvent.click(screen.getByRole("switch", { name: m.loop_section() }));
        expect(p.onToggleLoop).toHaveBeenCalledWith(true);
    });

    it("hides the tempo slider for a locked challenge", () => {
        render(<PracticeToolsDrawer {...props()} lockTempo />);
        expect(screen.queryByRole("slider", { name: m.scores_tempo() })).toBeNull();
    });

    it("reports a note-hints choice through setNoteHints", () => {
        const p = props();
        render(<PracticeToolsDrawer {...p} />);
        fireEvent.click(screen.getByRole("tab", { name: m.note_hints_always() }));
        expect(p.setNoteHints).toHaveBeenCalledWith("always");
    });

    it("holds only the live tweaks — the run-setup settings moved out", () => {
        render(<PracticeToolsDrawer {...props()} />);
        for (const gone of [m.keep_up_toggle(), m.hidden_notes_toggle(), m.tempo_trainer()]) {
            expect(screen.queryByRole("switch", { name: gone })).toBeNull();
        }
        expect(screen.queryByRole("tablist", { name: m.hand_label() })).toBeNull();
    });
});
