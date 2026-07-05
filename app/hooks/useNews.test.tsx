// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import type { NewsItem } from "../../core/news";
import { fakeNews } from "../adapters/fakeNews";
import type { NewsSource } from "../ports/news";
import { ServicesProvider } from "../contexts/services";
import { useNews } from "./useNews";

const ITEM: NewsItem = {
    id: "n1",
    imageUrl: "https://plinky.test/i.png",
    imageAlt: "A piano",
    linkUrl: "https://plinky.test",
};

const wrap =
    (news: NewsSource) =>
    ({ children }: { children: ReactNode }) => (
        <ServicesProvider services={{ news }}>{children}</ServicesProvider>
    );

describe("useNews", () => {
    it("returns the active item once the source resolves", async () => {
        const { result } = renderHook(() => useNews(), { wrapper: wrap(fakeNews(ITEM)) });
        await waitFor(() => expect(result.current?.id).toBe("n1"));
    });

    it("stays null when there is nothing live", async () => {
        const { result } = renderHook(() => useNews(), { wrapper: wrap(fakeNews(null)) });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(result.current).toBeNull();
    });

    it("swallows a failing fetch and stays null so the banner never breaks the page", async () => {
        const failing: NewsSource = { fetchActive: () => Promise.reject(new Error("down")) };
        const { result } = renderHook(() => useNews(), { wrapper: wrap(failing) });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(result.current).toBeNull();
    });
});
