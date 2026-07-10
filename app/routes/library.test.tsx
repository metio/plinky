// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { makeAssignment } from "../../core/assignment";
import { domXmlCodec } from "../adapters/domXmlCodec";
import { memoryStore } from "../adapters/memoryStore";
import { buildScore, saveUserScore } from "../lib/catalog";
import { createAssignmentsStore } from "../stores/assignmentsStore";
import type { ExerciseSource } from "../stores/exerciseSource";
import type { SongSource } from "../stores/songSource";
import { renderWithServices } from "../testing/renderWithServices";
import Library from "./library";

const source = <T,>(): T => ({ manifest: () => Promise.resolve([]) }) as unknown as T;

const USER_XML = `<?xml version="1.0"?><score-partwise><work><work-title>My Tune</work-title></work><part id="P1"><measure number="1"><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;

const mount = (store: ReturnType<typeof memoryStore>) =>
    renderWithServices(
        <MemoryRouter>
            <Library />
        </MemoryRouter>,
        { store, exercises: source<ExerciseSource>(), songs: source<SongSource>() },
    );

afterEach(cleanup);

describe("Library delete guard", () => {
    it("names the assignments still referencing a score on its delete confirm", async () => {
        const store = memoryStore();
        const score = buildScore(domXmlCodec, USER_XML, []);
        saveUserScore(store, score);
        createAssignmentsStore(store).save(
            makeAssignment({ id: "set", name: "Set", items: [{ id: score.id }] }),
        );
        mount(store);
        fireEvent.click(await screen.findByLabelText("Remove"));
        // The confirm label carries the blast radius; the delete still proceeds.
        fireEvent.click(screen.getByRole("button", { name: "Used by 1 assignment — remove?" }));
        await waitFor(() => expect(screen.queryByText("My Tune")).toBeNull());
    });

    it("asks plainly when no assignment references the score", async () => {
        const store = memoryStore();
        saveUserScore(store, buildScore(domXmlCodec, USER_XML, []));
        mount(store);
        fireEvent.click(await screen.findByLabelText("Remove"));
        expect(screen.getByRole("button", { name: "Remove?" })).toBeTruthy();
    });

    it("counts several referencing assignments in the plural", async () => {
        const store = memoryStore();
        const score = buildScore(domXmlCodec, USER_XML, []);
        saveUserScore(store, score);
        const assignments = createAssignmentsStore(store);
        assignments.save(makeAssignment({ id: "one", name: "One", items: [{ id: score.id }] }));
        assignments.save(makeAssignment({ id: "two", name: "Two", items: [{ id: score.id }] }));
        mount(store);
        fireEvent.click(await screen.findByLabelText("Remove"));
        expect(
            screen.getByRole("button", { name: "Used by 2 assignments — remove?" }),
        ).toBeTruthy();
    });
});
