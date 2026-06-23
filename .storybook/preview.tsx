// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Preview } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import { MidiProvider } from "../app/contexts/midi";
import "../app/app.css";

// Components read the MIDI context and some render <Link>, so every story gets a
// provider and an in-memory router.
const preview: Preview = {
    decorators: [
        (Story) => (
            <MemoryRouter>
                <MidiProvider>
                    <Story />
                </MidiProvider>
            </MemoryRouter>
        ),
    ],
};

export default preview;
