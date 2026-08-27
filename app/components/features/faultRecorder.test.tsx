// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ErrorFeed } from "../../ports/errorFeed";
import { renderWithServices } from "../../testing/renderWithServices";
import { FaultRecorder } from "./faultRecorder";

afterEach(cleanup);

// A feed a test can push faults through, standing in for the window's events.
function fakeFeed() {
    let emit: ((fault: { message: string; where: string }) => void) | null = null;
    let detached = false;
    const feed: ErrorFeed = {
        subscribe(onFault) {
            emit = onFault;
            return () => {
                detached = true;
            };
        },
    };
    return {
        feed,
        fault: (message: string, where = "/en/") => emit?.({ message, where }),
        get detached() {
            return detached;
        },
    };
}

describe("FaultRecorder", () => {
    it("writes down a fault that reached the window", () => {
        const feed = fakeFeed();
        const { services } = renderWithServices(<FaultRecorder />, { errorFeed: feed.feed });

        feed.fault("boom");

        expect(services.errors.load().map((one) => one.message)).toEqual(["boom"]);
    });

    it("counts a repeated fault instead of filling the log with it", () => {
        const feed = fakeFeed();
        const { services } = renderWithServices(<FaultRecorder />, { errorFeed: feed.feed });

        for (let i = 0; i < 50; i++) {
            feed.fault("boom");
        }

        expect(services.errors.load()).toHaveLength(1);
        expect(services.errors.load()[0]?.count).toBe(50);
    });

    it("renders nothing", () => {
        const feed = fakeFeed();
        const { container } = renderWithServices(<FaultRecorder />, { errorFeed: feed.feed });

        expect(container.innerHTML).toBe("");
    });

    it("lets go of the feed when it unmounts", () => {
        const feed = fakeFeed();
        const { unmount } = renderWithServices(<FaultRecorder />, { errorFeed: feed.feed });

        unmount();

        expect(feed.detached).toBe(true);
    });

    it("survives a store that throws rather than turning one fault into a loop", () => {
        // Recording a fault must never be the thing that raises one.
        const feed = fakeFeed();
        renderWithServices(<FaultRecorder />, {
            errorFeed: feed.feed,
            errors: {
                load: () => [],
                save: () => true,
                subscribe: () => () => {},
                clear: () => true,
                record: () => {
                    throw new Error("storage exploded");
                },
            },
        });

        expect(() => feed.fault("boom")).not.toThrow();
    });
});
