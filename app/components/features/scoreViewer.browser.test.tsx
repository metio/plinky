// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { testPrefsStore } from "../../testing/stores";
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MidiProvider } from "../../contexts/midi";
import { fakeMidi } from "../../adapters/fakeMidi";
import { ServicesProvider } from "../../contexts/services";
import type { DailyResult } from "../../../core/daily";
import { generatePhrase } from "../../../core/generator";

import { encodeGhost } from "../../../core/ghost";
import { browserStore } from "../../adapters/browserStore";
import { createGhostStore } from "../../stores/ghostStore";
import { GHOST_COLOR, LISTENED_COLOR, PLAYED_COLOR, WINDOW_COLOR } from "../../../core/scoreCanvas";
import { ScoreViewer } from "./scoreViewer";

// The browser context arrives with MIDI pre-granted; without a fake seam the
// provider would silently open a REAL Web MIDI connection under every test.
const midiFake = { midi: fakeMidi() };

const mount = (xml: string, props: Partial<{ beatsPerBar: number }> = {}) =>
    render(
        <MemoryRouter>
            <ServicesProvider services={midiFake}>
                <MidiProvider>
                    <ScoreViewer id="t" xml={xml} title="T" {...props} />
                </MidiProvider>
            </ServicesProvider>
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
                <ServicesProvider services={midiFake}>
                    <MidiProvider>
                        <ScoreViewer id="broken" xml="this is not MusicXML" title="Broken" />
                    </MidiProvider>
                </ServicesProvider>
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
                <ServicesProvider services={midiFake}>
                    <MidiProvider>
                        <ScoreViewer id="x" xml="this is not MusicXML" title="X" beatsPerBar={3} />
                    </MidiProvider>
                </ServicesProvider>
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

    it("opens a Runs drawer that explains how to make a run before any is saved", async () => {
        // The Runs button is always in the action row (on a savable piece) so the feature is
        // discoverable; opening it with nothing saved explains how to make a run.
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0.5);
        mount(phrase, { beatsPerBar: 4 });
        await awaitReady();
        fireEvent.click(screen.getByRole("button", { name: "Runs" }));
        expect(await screen.findByText(/play a piece through/i)).toBeTruthy();
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

    it("clears the on-staff fingering numbers when the toggle is switched back off", async () => {
        // Switching fingering off must remove the numbers, not leave them stranded over the
        // reclaimed space: a bare re-render repositions the cached labels without destroying
        // them, so the toggle rebuilds the graphic model to re-create them per the rule.
        vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);
        const phrase = generatePhrase({ bars: 2, beatsPerBar: 4, twoHands: false }, () => 0.5);
        mount(phrase, { beatsPerBar: 4 });
        fireEvent.click(await awaitReady());
        const score = screen.getByRole("img", { name: "T" });
        const textCount = () => score.querySelectorAll("text").length;
        const baseline = textCount();
        const fingers = screen.getByRole("button", { name: "Finger position numbers" });
        // On: the fingering digits are drawn, adding text nodes to the staff.
        fireEvent.click(fingers);
        await waitFor(() => expect(textCount()).toBeGreaterThan(baseline), { timeout: 30000 });
        // Off: every one of them is gone again.
        fireEvent.click(fingers);
        await waitFor(() => expect(textCount()).toBe(baseline), { timeout: 30000 });
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

    it("keeps a tempo-locked run alive when fingering numbers are toggled mid-play", async () => {
        // Toggling the on-staff fingering re-renders the score. The run — its cursor, its
        // scheduled ticks and its progress — must survive: a reload here would tear the
        // timers down yet leave the run "running", stranding the metronome with the button
        // stuck on Stop and no grade ever recorded.
        vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0.5);
        mount(phrase, { beatsPerBar: 4 });
        const practice = await screen.findByRole("button", { name: "Practice" });
        await waitFor(() => expect((practice as HTMLButtonElement).disabled).toBe(false), {
            timeout: 30000,
        });
        fireEvent.click(screen.getByRole("button", { name: "Practice tools" }));
        fireEvent.click(screen.getByRole("switch", { name: "Keep up" }));
        fireEvent.click(screen.getByRole("button", { name: "Practice" }));
        // Flip the fingering on while the run counts in — the switch it toggles used to be a
        // dependency of the reload effect, so this is exactly the mid-run redraw to survive.
        const fingers = await screen.findByRole("button", { name: "Finger position numbers" });
        expect(fingers.getAttribute("aria-pressed")).toBe("false");
        fireEvent.click(fingers);
        expect(
            screen
                .getByRole("button", { name: "Finger position numbers" })
                .getAttribute("aria-pressed"),
        ).toBe("true");
        // The run still counts in, plays to the end and reports the tally.
        expect(
            await screen.findByText(/kept up with 0 of/i, undefined, { timeout: 30000 }),
        ).toBeTruthy();
    });

    it("clears a finished self-paced result when a keep-up run runs, not stacking it under the card", async () => {
        // A finished self-paced grade panel is on screen (seeded). Starting a keep-up run
        // must wipe it: otherwise, once the keep-up run leaves full screen, its result card
        // and the stale self-paced grade panel both show at once — and the grade panel's
        // Save prompt would save the old, unrelated take.
        vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0.5);
        const seededResult: DailyResult = {
            grade: { accuracy: 90, timing: 80, flow: 70, dynamics: null, score: 82, letter: "B" },
            grid: [["best", "good"]],
            notes: [],
            tolerance: 1,
        };
        render(
            <MemoryRouter>
                <ServicesProvider services={midiFake}>
                    <MidiProvider>
                        <ScoreViewer
                            id="t"
                            xml={phrase}
                            title="T"
                            beatsPerBar={4}
                            seededResult={seededResult}
                        />
                    </MidiProvider>
                </ServicesProvider>
            </MemoryRouter>,
        );
        // The seeded self-paced grade panel is up (its Accuracy readout is on screen).
        expect(await screen.findAllByText("Accuracy", undefined, { timeout: 30000 })).toBeTruthy();
        // The seeded result shows before OSMD is ready, so wait for the score to be
        // interactive — a keep-up run bails while osmd is still null.
        await awaitReady();
        // Turn on Keep up and start the tempo-locked run.
        fireEvent.click(screen.getByRole("button", { name: "Practice tools" }));
        fireEvent.click(screen.getByRole("switch", { name: "Keep up" }));
        fireEvent.click(screen.getByRole("button", { name: "Practice" }));
        // The keep-up run counts in, runs to the end and reports its tally, leaving full
        // screen — the moment both result panels would coexist.
        await screen.findByText(/kept up with/i, undefined, { timeout: 30000 });
        // The stale self-paced grade panel is gone; only the keep-up card remains.
        expect(screen.queryByText("Accuracy")).toBeNull();
    });

    it("puts the cursor at a tapped bar while the loop is off, to start from there", async () => {
        const phrase = generatePhrase({ bars: 3, beatsPerBar: 4, twoHands: false }, () => 0.5);
        mount(phrase, { beatsPerBar: 4 });
        const score = await screen.findByRole("img", { name: "T" });
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
        await waitFor(
            () => {
                const rect = svg.getBoundingClientRect();
                const at = {
                    clientX: rect.left + rect.width * 0.3,
                    clientY: rect.top + rect.height * 0.5,
                };
                fireEvent.pointerDown(score, at);
                fireEvent.click(score, at);
                // The tap claims no loop — it shows the cursor at the bar instead, the
                // start position the next Practice or Listen resumes from.
                const cursor = document.querySelector('img[id^="cursorImg"]');
                if (!(cursor instanceof HTMLImageElement) || cursor.style.display === "none") {
                    throw new Error("cursor not shown yet");
                }
            },
            { timeout: 30000 },
        );
        expect(screen.queryByLabelText("Loop from bar")).toBeNull();
        expect(score.querySelectorAll("rect.plinky-bar-selection")).toHaveLength(0);
    });

    it("narrows the loop to a clicked bar, filling it with a red overlay", async () => {
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
        // With the loop on (whole song), clicking a bar narrows the range to it. OSMD
        // can re-layout after its first paint (Gecko especially), so the measure boxes
        // may still be settling; a 30%-width point on a three-bar line sits in bar 1,
        // so poll the click until it lands rather than firing once.
        fireEvent.click(screen.getByRole("button", { name: "Practice tools" }));
        fireEvent.click(screen.getByRole("switch", { name: "Loop" }));
        await waitFor(
            () => {
                const rect = svg.getBoundingClientRect();
                const at = {
                    clientX: rect.left + rect.width * 0.3,
                    clientY: rect.top + rect.height * 0.5,
                };
                // A genuine tap: the pointer press arms the click that follows.
                fireEvent.pointerDown(score, at);
                fireEvent.click(score, at);
                // The whole-song 1–3 range narrows to the single clicked bar.
                const from = screen.getByLabelText("Loop from bar") as HTMLInputElement;
                const to = screen.getByLabelText("Loop to bar") as HTMLInputElement;
                expect(to.value).toBe(from.value);
            },
            { timeout: 30000 },
        );
        // The selected bar gets a red backdrop rect behind its notes.
        const fills = score.querySelectorAll("rect.plinky-bar-selection");
        expect(fills.length).toBeGreaterThan(0);
        expect(fills[0]?.getAttribute("fill")).toBe("#ef4444");
    });

    it("captions each play option, spelling out what its values mean", async () => {
        render(
            <MemoryRouter>
                <ServicesProvider services={midiFake}>
                    <MidiProvider>
                        <ScoreViewer id="c" xml="this is not MusicXML" title="C" beatsPerBar={4} />
                    </MidiProvider>
                </ServicesProvider>
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

    it("keeps the loop on across a treadmill toggle — the two are independent", async () => {
        const phrase = generatePhrase({ bars: 3, beatsPerBar: 4, twoHands: false }, () => 0);
        mount(phrase, { beatsPerBar: 4 });
        const practice = await screen.findByRole("button", { name: "Practice" });
        await waitFor(() => expect((practice as HTMLButtonElement).disabled).toBe(false), {
            timeout: 30000,
        });
        const ready = () =>
            expect(
                (screen.getByRole("button", { name: "Practice" }) as HTMLButtonElement).disabled,
            ).toBe(false);
        fireEvent.click(screen.getByRole("button", { name: "Practice tools" }));
        // Turning the loop on repeats the whole piece — no bar-picking needed — and
        // closes the drawer so the bar-range controls aren't left behind its backdrop.
        fireEvent.click(screen.getByRole("switch", { name: "Loop" }));
        fireEvent.click(screen.getByRole("button", { name: "Practice tools" }));
        expect(screen.getByRole("switch", { name: "Loop" }).getAttribute("aria-checked")).toBe(
            "true",
        );
        // Toggling treadmill relayouts the score, but a bar range stays valid across a
        // relayout, so the loop must survive rather than silently switch off.
        fireEvent.click(screen.getByRole("switch", { name: "Treadmill" }));
        await waitFor(ready, { timeout: 30000 });
        expect(screen.getByRole("switch", { name: "Loop" }).getAttribute("aria-checked")).toBe(
            "true",
        );
        // And back off again — still on, so the two toggles never clobber each other.
        fireEvent.click(screen.getByRole("switch", { name: "Treadmill" }));
        await waitFor(ready, { timeout: 30000 });
        expect(screen.getByRole("switch", { name: "Loop" }).getAttribute("aria-checked")).toBe(
            "true",
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

    it("grades a completed run once even when the parent re-creates onRunComplete each render", async () => {
        // A review session passes a fresh inline onRunComplete on every render, and calling it
        // back flips parent state — which re-creates the callback. Without a per-run latch
        // the identity churn re-fires the completion effect while the run is still complete,
        // double-counting the run (history, lifetime, ghost, mastery, cadence). This harness
        // reproduces that churn: onRunComplete both records a call and forces a re-render.
        vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);
        const onRunComplete = vi.fn();
        // Built once so the xml prop stays referentially stable across the harness's
        // re-renders; a fresh string would reload OSMD mid-run and derail the test.
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0);
        function Harness() {
            const [, setPlayed] = useState(false);
            return (
                <ScoreViewer
                    id="t"
                    xml={phrase}
                    title="T"
                    beatsPerBar={4}
                    onRunComplete={() => {
                        onRunComplete();
                        setPlayed(true);
                    }}
                />
            );
        }
        render(
            <MemoryRouter>
                <ServicesProvider services={midiFake}>
                    <MidiProvider>
                        <Harness />
                    </MidiProvider>
                </ServicesProvider>
            </MemoryRouter>,
        );
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
        // Once the grade panel is up the completion effect has settled; a re-fire would
        // already have called onRunComplete a second time.
        await screen.findAllByText("Accuracy", undefined, { timeout: 30000 });
        expect(onRunComplete).toHaveBeenCalledTimes(1);
    });

    it("keeps a finished run as a take without a separate save press", async () => {
        vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);
        // A one-bar phrase whose every note is C5, so the same key clears each position.
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0);
        mount(phrase, { beatsPerBar: 4 });
        fireEvent.click(await awaitReady());
        const key = await screen.findByLabelText("C5");
        for (let i = 0; i < 4; i++) {
            fireEvent.pointerDown(key);
            fireEvent.pointerUp(key);
        }
        // The result panel confirms the automatic save instead of prompting for one —
        // finishing a song and later finding Runs empty read as data loss.
        expect(await screen.findByText("Run saved", undefined, { timeout: 30000 })).toBeTruthy();
        expect(screen.queryByText("Save this run?")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Runs" }));
        // The drawer lists the kept take rather than the how-to hint.
        expect(screen.queryByText(/play a piece through/i)).toBeNull();
        expect(screen.getAllByRole("button", { name: /replay/i }).length).toBeGreaterThan(0);
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

    it("hands off between Listen and Practice without losing the place", async () => {
        vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);
        // Four C5 notes: the same key clears every position, so playing two leaves the
        // run halfway with the cursor partway through.
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0);
        mount(phrase, { beatsPerBar: 4 });
        fireEvent.click(await awaitReady()); // Practice: a full-screen run over all four notes
        const key = await screen.findByLabelText("C5");
        for (let i = 0; i < 2; i++) {
            fireEvent.pointerDown(key);
            fireEvent.pointerUp(key);
        }
        // Hand off to Listen, then take back over with Practice: the run resumes from the
        // current place, not the top — so the couple of remaining notes finish it. Were
        // it rewound, four fresh notes would be needed and the run would never complete.
        fireEvent.click(screen.getByRole("button", { name: "Listen" }));
        fireEvent.click(await screen.findByRole("button", { name: "Practice" }));
        const resumed = await screen.findByLabelText("C5");
        for (let i = 0; i < 2; i++) {
            fireEvent.pointerDown(resumed);
            fireEvent.pointerUp(resumed);
        }
        expect(await screen.findAllByText("Accuracy", undefined, { timeout: 30000 })).toBeTruthy();
    });

    it("keeps the place when you leave full screen and come back", async () => {
        vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);
        // Four C5 notes; playing two leaves the run halfway.
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0);
        mount(phrase, { beatsPerBar: 4 });
        fireEvent.click(await awaitReady()); // Practice: a full-screen run over all four notes
        const key = await screen.findByLabelText("C5");
        for (let i = 0; i < 2; i++) {
            fireEvent.pointerDown(key);
            fireEvent.pointerUp(key);
        }
        // Step out of full screen mid-run, then start Practice again: it picks up where it
        // left off, so the two remaining notes finish it — a rewound run would need four.
        fireEvent.click(screen.getByRole("button", { name: "Exit full screen" }));
        fireEvent.click(await screen.findByRole("button", { name: "Practice" }));
        const resumed = await screen.findByLabelText("C5");
        for (let i = 0; i < 2; i++) {
            fireEvent.pointerDown(resumed);
            fireEvent.pointerUp(resumed);
        }
        expect(await screen.findAllByText("Accuracy", undefined, { timeout: 30000 })).toBeTruthy();
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
                <ServicesProvider services={midiFake}>
                    <MidiProvider>
                        <ScoreViewer
                            id="t"
                            xml={phrase}
                            title="T"
                            beatsPerBar={4}
                            seededResult={seededResult}
                        />
                    </MidiProvider>
                </ServicesProvider>
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
                <ServicesProvider services={midiFake}>
                    <MidiProvider>
                        <ScoreViewer
                            id="t"
                            xml={phrase}
                            title="T"
                            beatsPerBar={4}
                            seededResult={seededResult}
                        />
                    </MidiProvider>
                </ServicesProvider>
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
                <ServicesProvider services={midiFake}>
                    <MidiProvider>
                        <ScoreViewer id="a" xml="this is not MusicXML" title="A" />
                    </MidiProvider>
                </ServicesProvider>
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
        createGhostStore(browserStore).save("t", [0, 500, 1000]);
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
        createGhostStore(browserStore).save("t", [0, 500, 1000]);
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
                <ServicesProvider services={midiFake}>
                    <MidiProvider>
                        <ScoreViewer id="t" xml={phrase} title="T" beatsPerBar={4} canShareGhost />
                    </MidiProvider>
                </ServicesProvider>
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

    it("leaves a blue trail on the notes Listen has played", async () => {
        const phrase = generatePhrase({ bars: 3, beatsPerBar: 4, twoHands: false }, () => 0.5);
        mount(phrase, { beatsPerBar: 4 });
        await enterAndListen();
        // As playback advances, the notes it has moved past wear the persistent listened
        // colour — a trail showing which stretches the computer played.
        await expect
            .poll(
                () =>
                    Array.from(document.querySelectorAll("g[fill]")).some(
                        (group) => group.getAttribute("fill") === LISTENED_COLOR,
                    ),
                { timeout: 15000 },
            )
            .toBe(true);
    });

    it("offers Restart while listening and takes the playback back to the top", async () => {
        const phrase = generatePhrase({ bars: 3, beatsPerBar: 4, twoHands: false }, () => 0.5);
        mount(phrase, { beatsPerBar: 4 });
        await enterAndListen();
        // Let playback advance far enough to leave a trail.
        await expect
            .poll(() => document.querySelectorAll(`g[fill="${LISTENED_COLOR}"]`).length, {
                timeout: 15000,
            })
            .toBeGreaterThan(0);
        fireEvent.click(screen.getByRole("button", { name: "Restart" }));
        // The trail wipes, so the blue tells the story of the fresh pass only…
        expect(document.querySelectorAll(`g[fill="${LISTENED_COLOR}"]`).length).toBe(0);
        // …and Listen keeps playing, now from the first note.
        expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy();
    });

    it("leaves the note sounding at a Listen stop blue, not snapped back to black", async () => {
        const phrase = generatePhrase({ bars: 3, beatsPerBar: 4, twoHands: false }, () => 0.5);
        mount(phrase, { beatsPerBar: 4 });
        await enterAndListen();
        await expect
            .poll(() => document.querySelectorAll(`g[fill="${WINDOW_COLOR}"]`).length, {
                timeout: 15000,
            })
            .toBeGreaterThan(0);
        const sounding = Array.from(document.querySelectorAll(`g[fill="${WINDOW_COLOR}"]`));
        fireEvent.click(screen.getByRole("button", { name: "Stop" }));
        // The note under the cursor at the stop joins the trail — a handoff to
        // Practice must not leave a single uncoloured gap between blue and green.
        for (const group of sounding) {
            expect(group.getAttribute("fill")).toBe(LISTENED_COLOR);
        }
    });

    it("keeps the notes you practised coloured when you hand off to Listen", async () => {
        vi.spyOn(Element.prototype, "requestFullscreen").mockResolvedValue(undefined);
        // Four C5 notes; play two so they turn green.
        const phrase = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: false }, () => 0);
        const { container } = mount(phrase, { beatsPerBar: 4 });
        fireEvent.click(await awaitReady());
        const key = await screen.findByLabelText("C5");
        for (let i = 0; i < 2; i++) {
            fireEvent.pointerDown(key);
            fireEvent.pointerUp(key);
        }
        await waitFor(
            () => expect(container.querySelector(`[fill="${PLAYED_COLOR}"]`)).toBeTruthy(),
            { timeout: 30000 },
        );
        // Handing off to Listen doesn't wipe the score — the notes you played stay green,
        // so the record of how the piece was played survives the switch.
        fireEvent.click(screen.getByRole("button", { name: "Listen" }));
        expect(container.querySelector(`[fill="${PLAYED_COLOR}"]`)).toBeTruthy();
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

    it("keeps the chosen hand across a relayout — the hand belongs to the piece, not the layout", async () => {
        const grand = generatePhrase({ bars: 1, beatsPerBar: 4, twoHands: true }, () => 0.5);
        mount(grand, { beatsPerBar: 4 });
        fireEvent.click(await screen.findByRole("button", { name: "Practice tools" }));
        const left = await screen.findByRole("tab", { name: "Left" }, { timeout: 30000 });
        fireEvent.click(left);
        await expect
            .poll(() => screen.getByRole("tab", { name: "Left" }).getAttribute("aria-selected"))
            .toBe("true");
        // Toggling bar numbers relayouts the score (a fresh OSMD render), just like
        // treadmill/transpose/fingering. The hand choice must survive it rather than
        // silently reverting to Both and drilling both hands under the player.
        fireEvent.click(screen.getByRole("switch", { name: "Bar numbers" }));
        await expect
            .poll(() => screen.getByRole("tab", { name: "Left" }).getAttribute("aria-selected"), {
                timeout: 30000,
            })
            .toBe("true");
        expect(screen.getByRole("tab", { name: "Both" }).getAttribute("aria-selected")).toBe(
            "false",
        );
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
        // Enabling closes the drawer so the freshly revealed range controls are
        // reachable, not buried behind its backdrop; the range seeds to the whole
        // piece — OSMD reported three bars.
        const to = screen.getByLabelText("Loop to bar") as HTMLInputElement;
        expect(to.value).toBe("3");
        fireEvent.click(screen.getByRole("button", { name: "Practice tools" }));
        expect(screen.getByRole("switch", { name: "Loop" }).getAttribute("aria-checked")).toBe(
            "true",
        );
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
        // The transpose control lives in the Practice-tools drawer, which mounts its
        // contents only while open.
        fireEvent.click(screen.getByRole("button", { name: "Practice tools" }));
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
                <ServicesProvider services={midiFake}>
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
                </ServicesProvider>
            </MemoryRouter>,
        );
        await awaitReady();
        // Open the drawer (where transpose would live) and confirm it isn't there —
        // a locked-tempo challenge must stay in the written key for everyone.
        fireEvent.click(screen.getByRole("button", { name: "Practice tools" }));
        expect(screen.queryByText("Transpose")).toBeNull();
    });
});
