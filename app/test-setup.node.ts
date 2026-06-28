// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";
import { handlers } from "./mocks/handlers";

// Node-project setup: a Mock Service Worker server intercepts the catalogue/score fetches
// for every node (and jsdom) test, so no test stubs the global fetch — the stub leaks
// that flaked the combined coverage run can't happen. A test overrides a route with
// `server.use(...)`; resetHandlers restores the defaults after each.
export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
