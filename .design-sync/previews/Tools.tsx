// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Mirrors app/routes/tools.stories.tsx. Owned rather than generated because the story
// imports the page as a DEFAULT export, and the converter matches a module to the bundle
// by file name: "tools" is not the exported name "Tools", so the redirect hands the
// story the whole global object instead of the component. Importing the name directly
// from the package is what the redirect would have done.
import { ServicesProvider, Tools } from "plinky";
import { memoryStore } from "@ds-stories/app/adapters/memoryStore";

export const Default = () => (
    <ServicesProvider services={{ store: memoryStore() }}>
        <Tools />
    </ServicesProvider>
);
