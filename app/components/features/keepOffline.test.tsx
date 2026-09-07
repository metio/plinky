// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderWithServices } from "../../testing/renderWithServices";
import { KeepOffline } from "./keepOffline";

afterEach(cleanup);

describe("KeepOffline", () => {
    it("announces the language on every mount while the setting is on", () => {
        const announced: string[] = [];
        const { services } = renderWithServices(
            <KeepOffline announce={(l) => announced.push(l)} />,
        );
        expect(announced).toEqual([]);
        act(() => {
            services.prefs.save({ ...services.prefs.load(), keepOffline: true });
        });
        expect(announced).toEqual(["en"]);
    });
});
