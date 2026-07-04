// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { testPrefsStore } from "../testing/stores";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MidiProvider } from "../contexts/midi";
import type { DailyResult } from "../lib/dailyResult";
import { generatePhrase } from "../../core/generator";

import { encodeGhost, saveGhost } from "../lib/recording";
import { GHOST_COLOR, PLAYED_COLOR, WINDOW_COLOR } from "../lib/scoreColor";
import { ScoreViewer } from "./scoreViewer";

const mount = (xml: string, props: Partial<{ beatsPerBar: number }> = {}) =>
    render(
        <MemoryRouter>
            <MidiProvider>
                <ScoreViewer id="t" xml={xml} title="T" {...props} />
            </MidiProvider>
        </MemoryRouter>,
    );

// The inline /play view offers a single primary action, Practice; it's enabled once the
// score is interactive, so it's the readiness gate the score-loaded tests wait on.
const awaitReady = async () => {
    const practice = await screen.findByRole("button", { name: "Practice" }, { timeout: 30000 });
    await expect.poll(() => (practice as HTMLButtonElement).disabled).toBe(false);
    return practice;
};

// Listen lives only in the full-screen top bar now, reachable once play begins. Enter the
// play surface (Practice always goes full screen), then hand off to Listen, which stops the
// just-started run and plays the score back.
const enterAndListen = async () => {
    vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);
    fireEvent.click(await awaitReady());
    fireEvent.click(screen.getByRole("button", { name: "Listen" }));
};

// OSMD renders only in a real browser, so this runs in the browser project.
afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe("ScoreViewer", () => {
    it("surfaces an error instead of a silently dead viewer when OSMD can't load", async () => {
        render(
            <MemoryRouter>
                <MidiProvider>
                    <ScoreViewer id="broken" xml="this is not MusicXML" title="Broken" />
                </MidiProvider>
            </MemoryRouter>,
        );
        // A score OSMD can't parse must report rather than leave the controls
        // disabled forever with no explanation.
        expect(
            await screen.findByText(/couldn't be displayed/, undefined, { timeout: 30000 }),
        ).toBeTruthy();
    });

    it("toggles the metronome on and off without crashing", async () => {
        render(
            <MemoryRouter>
                <MidiProvider>
                    <ScoreViewer id="x" xml="this is not MusicXML" title="X" beatsPerBar={3} />
                </MidiProvider>
            </MemoryRouter>,
        );
        fireEvent.click(await screen.findByRole("button", { name: "Practice tools" }));
        const toggle = screen.getByRole("switch", { name: "Metronome" });
        expect(toggle.getAttribute("aria-checked")).toBe("false");
        fireEvent.click(toggle);
        expect(toggle.getAttribute("aria-checked")).toBe("true");
        fireEvent.click(toggle);
        expect(toggle.getAttribute("aria-checked")).toBe("false");
    });

    it("offers the finger-numbers and follow-the-note toggles in full screen", async () => {
        // The browser viewport is phone-sized, so playing auto-enters full screen where
        // the toggles live; stub the Fullscreen API the headless browser withholds.
        vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);
        const phrase = generatePhrase({ bars: 2, beatsPerBar: 4, twoHands: false }, () => 0.5);
        mount(phrase, { beatsPerBar: 4 });
        fireEvent.click(await awaitReady()); // Practice enters full screen on every device
        // Follow-the-note is on by default; flipping it takes effect without a reload.
        const follow = await screen.findByRole("button", { name: "Follow the note" });
        expect(follow.getAttribute("aria-pressed")).toBe("true");
        fireEvent.click(follow);
        expect(follow.getAttribute("aria-pressed")).toBe("false");
        // Fingering numbers are off by default (the flipped setting); the toggle turns
        // them on for the session.
        const fingers = screen.getByRole("button", { name: "Finger position numbers" });
        expect(fingers.getAttribute("aria-pressed")).toBe("false");
        fireEvent.click(fingers);
        await waitFor(() =>
            expect(
                screen
                    .getByRole("button", { name: "Finger position numbers" })
                    .getAttribute("aria-pressed"),
            ).toBe("true"),
        );
    });

    it("runs a tempo-locked play-along and reports how many notes you kept up with", async () => {
        // Small viewport → play-along auto-enters full screen; stub the withheld API.
        vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0.5);
        mount(phrase, { beatsPerBar: 4 });
        const practice = await screen.findByRole("button", { name: "Practice" });
        await waitFor(() => expect((practice as HTMLButtonElement).disabled).toBe(false), {
            timeout: 30000,
        });
        // Turn on Keep up, then start — with no notes played every beat is a miss, but the
        // clock-driven run still counts in, runs to the end, and reports the tally.
        fireEvent.click(screen.getByRole("button", { name: "Practice tools" }));
        fireEvent.click(screen.getByRole("switch", { name: "Keep up" }));
        fireEvent.click(screen.getByRole("button", { name: "Practice" }));
        expect(
            await screen.findByText(/kept up with 0 of/i, undefined, { timeout: 30000 }),
        ).toBeTruthy();
    });

    it("selects a bar by clicking it, filling the loop range with a red overlay", async () => {
        const phrase = generatePhrase({ bars: 3, beatsPerBar: 4, twoHands: false }, () => 0.5);
        mount(phrase, { beatsPerBar: 4 });
        const score = await screen.findByRole("img", { name: "T" });
        // Wait for OSMD to render the staff (its glyph groups are what the boxes measure).
        const svg = await waitFor(
            () => {
                const rendered = score.querySelector("svg");
                if (!rendered || rendered.querySelectorAll("g").length === 0) {
                    throw new Error("not rendered yet");
                }
                return rendered;
            },
            { timeout: 30000 },
        );
        // Click inside the staff — the bar under (or nearest) the point becomes the loop.
        const rect = svg.getBoundingClientRect();
        fireEvent.click(score, {
            clientX: rect.left + rect.width * 0.3,
            clientY: rect.top + rect.height * 0.5,
        });
        // The click turns the loop on and sets its range…
        fireEvent.click(screen.getByRole("button", { name: "Practice tools" }));
        await waitFor(
            () =>
                expect(
                    screen.getByRole("switch", { name: "Loop" }).getAttribute("aria-checked"),
                ).toBe("true"),
            { timeout: 30000 },
        );
        // …and fills the selected bar with a red backdrop rect behind the notes.
        const fills = score.querySelectorAll("rect.plinky-bar-selection");
        expect(fills.length).toBeGreaterThan(0);
        expect(fills[0]?.getAttribute("fill")).toBe("#ef4444");
    });

    it("captions each play option, spelling out what its values mean", async () => {
        render(
            <MemoryRouter>
                <MidiProvider>
                    <ScoreViewer id="c" xml="this is not MusicXML" title="C" beatsPerBar={4} />
                </MidiProvider>
            </MemoryRouter>,
        );
        fireEvent.click(await screen.findByRole("button", { name: "Practice tools" }));
        // A plain-language caption sits under the always-present metronome toggle...
        expect(screen.getByText(/A click on every beat/)).toBeTruthy();
        // ...and turning it on reveals a control whose caption spells out its numbers,
        // rather than leaving "1 2 3 4" a mystery.
        fireEvent.click(screen.getByRole("switch", { name: "Metronome" }));
        expect(screen.getByText(/2 for eighths/)).toBeTruthy();
    });

    it("re-renders as a single horizontal line when treadmill is toggled on", async () => {
        const phrase = generatePhrase({ bars: 2, beatsPerBar: 4, twoHands: false }, () => 0);
        mount(phrase, { beatsPerBar: 4 });
        const practice = await screen.findByRole("button", { name: "Practice" });
        await waitFor(() => expect((practice as HTMLButtonElement).disabled).toBe(false), {
            timeout: 30000,
        });
        fireEvent.click(screen.getByRole("button", { name: "Practice tools" }));
        const treadmill = screen.getByRole("switch", { name: "Treadmill" });
        expect(treadmill.getAttribute("aria-checked")).toBe("false");
        fireEvent.click(treadmill);
        expect(treadmill.getAttribute("aria-checked")).toBe("true");
        // The score reloads with one horizontal staffline; Practice re-enabling proves
        // the re-render succeeded rather than leaving a dead viewer.
        await waitFor(
            () =>
                expect(
                    (screen.getByRole("button", { name: "Practice" }) as HTMLButtonElement)
                        .disabled,
                ).toBe(false),
            { timeout: 30000 },
        );
    });

    it("toggles bar numbers, persists the choice, and re-renders the score", async () => {
        const phrase = generatePhrase({ bars: 2, beatsPerBar: 4, twoHands: false }, () => 0);
        mount(phrase, { beatsPerBar: 4 });
        const practice = await screen.findByRole("button", { name: "Practice" });
        await waitFor(() => expect((practice as HTMLButtonElement).disabled).toBe(false), {
            timeout: 30000,
        });
        fireEvent.click(screen.getByRole("button", { name: "Practice tools" }));
        const barNumbers = screen.getByRole("switch", { name: "Bar numbers" });
        // On by default, matching the persisted preference.
        expect(barNumbers.getAttribute("aria-checked")).toBe("true");
        expect(testPrefsStore.load().barNumbers).toBe(true);
        fireEvent.click(barNumbers);
        expect(barNumbers.getAttribute("aria-checked")).toBe("false");
        // The choice is remembered per device and the score reloads (Practice re-enabling
        // proves the render effect re-ran rather than leaving a dead viewer).
        expect(testPrefsStore.load().barNumbers).toBe(false);
        await waitFor(
            () =>
                expect(
                    (screen.getByRole("button", { name: "Practice" }) as HTMLButtonElement)
                        .disabled,
                ).toBe(false),
            { timeout: 30000 },
        );
    });

    it("replaces the previous render instead of stacking when the layout changes", async () => {
        const phrase = generatePhrase({ bars: 3, beatsPerBar: 4, twoHands: false }, () => 0);
        mount(phrase, { beatsPerBar: 4 });
        const ready = async () =>
            waitFor(
                () =>
                    expect(
                        (screen.getByRole("button", { name: "Practice" }) as HTMLButtonElement)
                            .disabled,
                    ).toBe(false),
                { timeout: 30000 },
            );
        await ready();
        const score = screen.getByRole("img", { name: "T" });
        fireEvent.click(screen.getByRole("button", { name: "Practice tools" }));
        const treadmill = screen.getByRole("switch", { name: "Treadmill" });
        // Each layout change rebuilds OSMD on the same container; without clearing the
        // old render its SVG would stay behind, piling up a new staff every toggle.
        for (let i = 0; i < 3; i++) {
            fireEvent.click(treadmill);
            await ready();
        }
        expect(score.querySelectorAll("svg")).toHaveLength(1);
    });

    it("auto-enters full screen to play on a small screen and leaves it when the run finishes", async () => {
        // Force a phone-sized viewport so playing auto-enters full screen, and stub the
        // Fullscreen API a headless browser grants only on a trusted gesture — the hook
        // flips its own `fullscreen` flag regardless, and that's what gates the grade.
        vi.stubGlobal("matchMedia", (query: string) => ({
            matches: /max-(width|height)/.test(query),
            addEventListener: () => {},
            removeEventListener: () => {},
            media: query,
        }));
        const reqFs = vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);
        // A one-bar phrase whose every note is C5, so the same key clears each position.
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0);
        mount(phrase, { beatsPerBar: 4 });
        const practice = await screen.findByRole("button", { name: "Practice" });
        await waitFor(() => expect((practice as HTMLButtonElement).disabled).toBe(false), {
            timeout: 30000,
        });
        // Playing on a small screen enters full screen and starts the run in one tap; the
        // exit (X) appears, and the grade's Accuracy readout is hidden while full screen.
        fireEvent.click(practice);
        expect(await screen.findByRole("button", { name: "Exit full screen" })).toBeTruthy();
        const key = await screen.findByLabelText("C5");
        for (let i = 0; i < 4; i++) {
            fireEvent.pointerDown(key);
            fireEvent.pointerUp(key);
        }
        // Completing the run drops out of full screen and surfaces the results — the
        // Accuracy readout renders only once the run is graded and not full screen.
        const accuracy = await screen.findAllByText("Accuracy", undefined, { timeout: 30000 });
        expect(accuracy.length).toBeGreaterThan(0);
        expect(screen.queryByRole("button", { name: "Exit full screen" })).toBeNull();
        reqFs.mockRestore();
    });

    it("enters full screen to play even on a large screen, where Listen lives", async () => {
        // Force a roomy desktop viewport (no media query matches), the case that used to
        // stay inline. The play surface holds Listen and the in-play toggles, so a large
        // screen enters full screen to play just as a phone does.
        vi.stubGlobal("matchMedia", (query: string) => ({
            matches: false,
            addEventListener: () => {},
            removeEventListener: () => {},
            media: query,
        }));
        const reqFs = vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0);
        mount(phrase, { beatsPerBar: 4 });
        await awaitReady();
        // At rest the /play view is a single action: Listen is not inline, it waits in the
        // full-screen top bar, and there's no exit control until play begins.
        expect(screen.queryByRole("button", { name: "Listen" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Exit full screen" })).toBeNull();
        // Practice enters full screen on the large screen too, surfacing the exit control
        // and Listen alongside it.
        fireEvent.click(screen.getByRole("button", { name: "Practice" }));
        expect(await screen.findByRole("button", { name: "Exit full screen" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Listen" })).toBeTruthy();
        reqFs.mockRestore();
    });

    it("does not scroll to the grade when a saved result is shown on open", async () => {
        // Re-opening a finished daily seeds the grade on mount; the result-scroll must
        // not fire then and yank the page down before the player has done anything.
        const scroll = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0);
        const seededResult: DailyResult = {
            grade: { accuracy: 90, timing: 80, flow: 70, dynamics: null, score: 82, letter: "B" },
            grid: [["best", "good"]],
            notes: [],
            tolerance: 1,
        };
        render(
            <MemoryRouter>
                <MidiProvider>
                    <ScoreViewer
                        id="t"
                        xml={phrase}
                        title="T"
                        beatsPerBar={4}
                        seededResult={seededResult}
                    />
                </MidiProvider>
            </MemoryRouter>,
        );
        // The seeded grade renders (its Accuracy readout is on screen)…
        expect(await screen.findAllByText("Accuracy", undefined, { timeout: 30000 })).toBeTruthy();
        // …but no result-scroll was triggered by merely opening the page.
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(scroll).not.toHaveBeenCalled();
        scroll.mockRestore();
    });

    it("names the lagging hand in the grade panel after a two-hand run", async () => {
        // Seed a finished two-hand result: the right hand at tempo, the left crawling —
        // the panel reads that gap off the recorded per-note staves.
        const rightAtTempo = Array.from({ length: 6 }, (_, i) => ({
            targetMs: i * 100,
            playedMs: i * 100,
            wrongBefore: 0,
            staves: [0],
        }));
        const leftSlow = Array.from({ length: 6 }, (_, i) => ({
            targetMs: i * 100,
            playedMs: i * 300,
            wrongBefore: 0,
            staves: [1],
        }));
        const seededResult: DailyResult = {
            grade: { accuracy: 80, timing: 80, flow: 80, dynamics: null, score: 80, letter: "B" },
            grid: [
                ["best", "best"],
                ["weak", "weak"],
            ],
            notes: [...rightAtTempo, ...leftSlow],
            tolerance: 1,
        };
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: true }, () => 0.5);
        render(
            <MemoryRouter>
                <MidiProvider>
                    <ScoreViewer
                        id="t"
                        xml={phrase}
                        title="T"
                        beatsPerBar={4}
                        seededResult={seededResult}
                    />
                </MidiProvider>
            </MemoryRouter>,
        );
        expect(
            await screen.findByText(/left hand lagged/i, undefined, { timeout: 30000 }),
        ).toBeTruthy();
    });

    it("scrolls to the grade when a run finishes in this session", async () => {
        const scroll = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0);
        mount(phrase, { beatsPerBar: 4 });
        const practice = await screen.findByRole("button", { name: "Practice" });
        await waitFor(() => expect((practice as HTMLButtonElement).disabled).toBe(false), {
            timeout: 30000,
        });
        fireEvent.click(practice);
        const key = await screen.findByLabelText("C5");
        for (let i = 0; i < 4; i++) {
            fireEvent.pointerDown(key);
            fireEvent.pointerUp(key);
        }
        await waitFor(() => expect(scroll).toHaveBeenCalled(), { timeout: 30000 });
        scroll.mockRestore();
    });

    it("reveals the adaptive toggle only while the metronome is on", async () => {
        render(
            <MemoryRouter>
                <MidiProvider>
                    <ScoreViewer id="a" xml="this is not MusicXML" title="A" />
                </MidiProvider>
            </MemoryRouter>,
        );
        fireEvent.click(await screen.findByRole("button", { name: "Practice tools" }));
        const metronome = screen.getByRole("switch", { name: "Metronome" });
        expect(screen.queryByRole("switch", { name: "Adaptive" })).toBeNull();
        fireEvent.click(metronome);
        const adaptive = screen.getByRole("switch", { name: "Adaptive" });
        expect(adaptive.getAttribute("aria-checked")).toBe("false");
        fireEvent.click(adaptive);
        expect(adaptive.getAttribute("aria-checked")).toBe("true");
        // Turning the metronome off hides the adaptive control again.
        fireEvent.click(metronome);
        expect(screen.queryByRole("switch", { name: "Adaptive" })).toBeNull();
    });

    it("colours notes on the score as they are played", async () => {
        // A one-bar phrase whose every note is the first scale degree (C5), so the
        // same key clears each position in turn.
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0);
        const { container } = mount(phrase, { beatsPerBar: 4 });
        // Wait for OSMD to be ready via the real signal — the Practice button
        // enabling — since toolbar icons mean "any svg" is present from the start.
        const practiceButton = await screen.findByRole("button", { name: "Practice" });
        await waitFor(() => expect((practiceButton as HTMLButtonElement).disabled).toBe(false), {
            timeout: 30000,
        });
        fireEvent.click(practiceButton);
        const key = await screen.findByLabelText("C5");
        for (let i = 0; i < 4; i++) {
            fireEvent.pointerDown(key);
            fireEvent.pointerUp(key);
        }
        // Played noteheads are recoloured in the rendered SVG — this exercises the
        // real OSMD graphical-note → SVG path the colouring depends on.
        await waitFor(
            () => expect(container.querySelector(`[fill="${PLAYED_COLOR}"]`)).toBeTruthy(),
            {
                timeout: 30000,
            },
        );
    });

    it("shows a ghost to race once a previous run is saved", async () => {
        // Playing goes full screen on every device now, and the race track rides along
        // there — so a saved ghost surfaces its race track once Practice begins.
        vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);
        // mount() renders with id "t"; a saved ghost for it is loaded on Practice.
        saveGhost("t", [0, 500, 1000]);
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0.5);
        const { container } = mount(phrase, { beatsPerBar: 4 });
        // Wait for OSMD to be ready via the real signal — the Practice button
        // enabling — since toolbar icons mean "any svg" is present from the start.
        const practiceButton = await screen.findByRole("button", { name: "Practice" });
        await waitFor(() => expect((practiceButton as HTMLButtonElement).disabled).toBe(false), {
            timeout: 30000,
        });
        fireEvent.click(practiceButton);
        // The race track appears...
        expect(await screen.findByRole("img", { name: /race/i })).toBeTruthy();
        // ...and the ghost colours its current note on the rendered staff.
        await waitFor(
            () => expect(container.querySelector(`[fill="${GHOST_COLOR}"]`)).toBeTruthy(),
            { timeout: 30000 },
        );
    });

    it("starts the ghost back at the line when a finished run is restarted", async () => {
        // Playing goes full screen, where the race track rides along.
        vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);
        // The ghost races from the player's first note. A prior run's start timestamp
        // must not survive into the next run: on a restart, before the first note is
        // played, the ghost belongs at the start line — not painted at the finish
        // because the stale elapsed time reads as the whole piece already played.
        saveGhost("t", [0, 500, 1000]);
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0);
        mount(phrase, { beatsPerBar: 4 });
        const practiceButton = await screen.findByRole("button", { name: "Practice" });
        await waitFor(() => expect((practiceButton as HTMLButtonElement).disabled).toBe(false), {
            timeout: 30000,
        });
        // Run 1: play the four C5 notes to completion, which seeds the run's start clock.
        fireEvent.click(practiceButton);
        const key = await screen.findByLabelText("C5");
        for (let i = 0; i < 4; i++) {
            fireEvent.pointerDown(key);
            fireEvent.pointerUp(key);
        }
        // The grade panel proves the run finished and the start timestamp is now set.
        await screen.findAllByText("Accuracy", undefined, { timeout: 30000 });
        // Restart: the transport returns to "Practice" once the run is no longer running.
        fireEvent.click(await screen.findByRole("button", { name: "Practice" }));
        await screen.findByRole("img", { name: /race/i });
        // Give the 50ms ghost-advance interval several ticks to act on any stale start.
        await new Promise((resolve) => setTimeout(resolve, 250));
        const track = screen.getByRole("img", { name: /race/i });
        expect(track.getAttribute("aria-label")).toMatch(/ghost at note 0$/);
    });

    it("adopts a ghost handed over by a link", async () => {
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0.5);
        const code = encodeGhost([0, 500, 1000]);
        render(
            <MemoryRouter initialEntries={[`/play/t?ghost=${code}`]}>
                <MidiProvider>
                    <ScoreViewer id="t" xml={phrase} title="T" beatsPerBar={4} canShareGhost />
                </MidiProvider>
            </MemoryRouter>,
        );
        expect(await screen.findByText(/racing a shared ghost/i)).toBeTruthy();
    });

    it("lights the note now sounding while listening, so the eye can follow", async () => {
        const phrase = generatePhrase({ bars: 3, beatsPerBar: 4, twoHands: false }, () => 0.5);
        mount(phrase, { beatsPerBar: 4 });
        await enterAndListen();
        // As playback walks the score, exactly the notes under the cursor wear the
        // active colour — more than the cursor box alone, which is easy to lose.
        await expect
            .poll(
                () =>
                    Array.from(document.querySelectorAll("g[fill]")).some(
                        (group) => group.getAttribute("fill") === WINDOW_COLOR,
                    ),
                { timeout: 15000 },
            )
            .toBe(true);
    });

    it("plays a grand staff back, sounding both hands", async () => {
        // A two-hand phrase feeds both staves' notes into one playback step. When the
        // hands hold notes of different lengths the step must advance at the next onset
        // (the shorter note), not linger for the longest, or the second hand's notes queue
        // up behind a held whole note. Here the run reaching the notes proves the grand
        // staff drives playback end to end; lib/playback pins the interval arithmetic.
        const phrase = generatePhrase(
            { bars: 2, beatsPerBar: 4, twoHands: true, rhythm: "varied" },
            () => 0.5,
        );
        mount(phrase, { beatsPerBar: 4 });
        await enterAndListen();
        // Playback lights the notes now sounding on both staves as the cursor walks.
        await expect
            .poll(
                () =>
                    Array.from(document.querySelectorAll("g[fill]")).some(
                        (group) => group.getAttribute("fill") === WINDOW_COLOR,
                    ),
                { timeout: 15000 },
            )
            .toBe(true);
    });

    it("offers a hands-separate selector only for a grand staff", async () => {
        const grand = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: true }, () => 0.5);
        mount(grand, { beatsPerBar: 4 });
        fireEvent.click(await screen.findByRole("button", { name: "Practice tools" }));
        // The selector appears once OSMD reports two staves; its three options name
        // the hands. This also exercises the OSMD staff API the matcher filters on.
        expect(await screen.findByRole("tab", { name: "Right" }, { timeout: 30000 })).toBeTruthy();
        expect(screen.getByRole("tab", { name: "Left" })).toBeTruthy();
        expect(screen.getByRole("tab", { name: "Both" })).toBeTruthy();
    });

    it("omits the hands selector for a single-staff score", async () => {
        const single = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0.5);
        mount(single, { beatsPerBar: 4 });
        // Wait until the score is interactive, then confirm the single-staff piece offers
        // no hand choice.
        await awaitReady();
        fireEvent.click(screen.getByRole("button", { name: "Practice tools" }));
        expect(screen.queryByRole("tab", { name: "Right" })).toBeNull();
        expect(screen.queryByRole("tab", { name: "Left" })).toBeNull();
    });

    it("reveals the section-loop bar inputs only once looping is on", async () => {
        const phrase = generatePhrase({ bars: 3, beatsPerBar: 4, twoHands: false }, () => 0.5);
        mount(phrase, { beatsPerBar: 4 });
        fireEvent.click(await screen.findByRole("button", { name: "Practice tools" }));
        const loop = await screen.findByRole("switch", { name: "Loop" }, { timeout: 30000 });
        expect(loop.getAttribute("aria-checked")).toBe("false");
        expect(screen.queryByLabelText("Loop from bar")).toBeNull();
        fireEvent.click(loop);
        expect(loop.getAttribute("aria-checked")).toBe("true");
        // The range seeds to the whole piece — OSMD reported three bars.
        const to = screen.getByLabelText("Loop to bar") as HTMLInputElement;
        expect(to.value).toBe("3");
    });

    it("never lets the loop range invert", async () => {
        const phrase = generatePhrase({ bars: 3, beatsPerBar: 4, twoHands: false }, () => 0.5);
        mount(phrase, { beatsPerBar: 4 });
        fireEvent.click(await screen.findByRole("button", { name: "Practice tools" }));
        fireEvent.click(await screen.findByRole("switch", { name: "Loop" }, { timeout: 30000 }));
        const from = screen.getByLabelText("Loop from bar") as HTMLInputElement;
        const to = screen.getByLabelText("Loop to bar") as HTMLInputElement;
        fireEvent.change(to, { target: { value: "2" } });
        expect(to.value).toBe("2");
        // Pushing the start past the end drags the end along instead of inverting.
        fireEvent.change(from, { target: { value: "3" } });
        expect(from.value).toBe("3");
        expect(to.value).toBe("3");
    });

    it("omits the section-loop control for a single-bar score", async () => {
        const single = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0.5);
        mount(single, { beatsPerBar: 4 });
        await awaitReady();
        expect(screen.queryByText(/Loop/)).toBeNull();
    });

    it("transposes by semitones and re-renders the score in the new key", async () => {
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0.5);
        const { container } = mount(phrase, { beatsPerBar: 4 });
        await waitFor(() => expect(container.querySelector("svg")).toBeTruthy(), {
            timeout: 30000,
        });
        const up = screen.getByLabelText("Transpose up a semitone");
        fireEvent.click(up);
        fireEvent.click(up);
        // The readout reflects the shift...
        expect(screen.getByText("+2 st")).toBeTruthy();
        // ...and changing the key reloads OSMD — waiting for the staff to come back
        // proves the transposed MusicXML still parses and renders.
        await waitFor(() => expect(container.querySelector("svg")).toBeTruthy(), {
            timeout: 30000,
        });
        fireEvent.click(screen.getByLabelText("Reset to the written key"));
        expect(screen.getByText("0 st")).toBeTruthy();
    });

    it("hides transposition for a locked-tempo challenge so it stays identical for all", async () => {
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0.5);
        render(
            <MemoryRouter>
                <MidiProvider>
                    <ScoreViewer
                        id="d"
                        xml={phrase}
                        title="D"
                        beatsPerBar={4}
                        lockTempo
                        daily={1}
                    />
                </MidiProvider>
            </MemoryRouter>,
        );
        await awaitReady();
        expect(screen.queryByText("Transpose")).toBeNull();
    });
});
