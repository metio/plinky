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
    trainerOn: false,
    setTrainerOn: vi.fn(),
    trainerTarget: 140,
    setTrainerTarget: vi.fn(),
    metronomeOn: false,
    setMetronomeOn: vi.fn(),
    adaptive: false,
    setAdaptive: vi.fn(),
    liveTempo: 100,
    subdivision: 1,
    setSubdivision: vi.fn(),
    enforceTempo: false,
    setEnforceTempo: vi.fn(),
    guideNotes: true,
    setGuideNotes: vi.fn(),
    forgiving: false,
    setForgiving: vi.fn(),
    noteHints: "miss" as const,
    setNoteHints: vi.fn(),
    raceGhost: true,
    setRaceGhost: vi.fn(),
    staffCount: 1,
    hand: "both" as const,
    setHand: vi.fn(),
    practicing: false,
    loopAvailable: true,
    loopOn: false,
    onToggleLoop: vi.fn(),
    showTranspose: true,
    transpose: 0,
    setTranspose: vi.fn(),
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

    it("hides the tempo slider and trainer for a locked challenge", () => {
        render(<PracticeToolsDrawer {...props()} lockTempo />);
        expect(screen.queryByRole("slider", { name: m.scores_tempo() })).toBeNull();
        expect(screen.queryByRole("switch", { name: m.tempo_trainer() })).toBeNull();
    });

    it("reports a note-hints choice through setNoteHints", () => {
        const p = props();
        render(<PracticeToolsDrawer {...p} />);
        fireEvent.click(screen.getByRole("tab", { name: m.note_hints_always() }));
        expect(p.setNoteHints).toHaveBeenCalledWith("always");
    });

    it("offers the hands-separate selector only for a grand staff", () => {
        const { rerender } = render(<PracticeToolsDrawer {...props()} staffCount={1} />);
        expect(screen.queryByRole("tablist", { name: m.hand_label() })).toBeNull();
        rerender(<PracticeToolsDrawer {...props()} staffCount={2} />);
        expect(screen.getByRole("tablist", { name: m.hand_label() })).toBeTruthy();
    });

    it("reveals the guide-notes toggle only when keep-up is on", () => {
        const { rerender } = render(<PracticeToolsDrawer {...props()} enforceTempo={false} />);
        expect(screen.queryByRole("switch", { name: m.guide_notes_toggle() })).toBeNull();
        rerender(<PracticeToolsDrawer {...props()} enforceTempo />);
        expect(screen.getByRole("switch", { name: m.guide_notes_toggle() })).toBeTruthy();
    });
});
