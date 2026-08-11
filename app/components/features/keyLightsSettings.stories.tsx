// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { DEFAULT_PREFS, type Prefs } from "../../../core/prefs";
import { fakeKeyLights } from "../../adapters/fakeKeyLights";
import { KeyLightsSettings } from "./keyLightsSettings";

// The panel is a pure function of prefs plus a port, so the stories only have to hold
// the prefs. The port is the ledger-keeping fake — nothing glows in a screenshot.
const meta: Meta<typeof KeyLightsSettings> = {
    title: "Features/KeyLightsSettings",
    component: KeyLightsSettings,
};
export default meta;

type Story = StoryObj<typeof KeyLightsSettings>;

function Panel({ initial }: { initial: Partial<Prefs> }) {
    const [prefs, setPrefs] = useState<Prefs>({ ...DEFAULT_PREFS, ...initial });
    return (
        <KeyLightsSettings
            prefs={prefs}
            update={(patch) => setPrefs((current) => ({ ...current, ...patch }))}
            keyLights={fakeKeyLights()}
        />
    );
}

// Off, which is the default: one switch and nothing else to read.
export const Off: Story = {
    render: () => <Panel initial={{}} />,
};

// On, showing the whole arrangement — the maker, both channels, and the test.
export const Configured: Story = {
    render: () => <Panel initial={{ keyLights: true, lightProfile: "casio" }} />,
};
