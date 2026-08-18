// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { SwitchField } from "./fields";
import { KeysIcon, TrashIcon } from "./icons";
import { SettingsSection } from "./settingsSection";

const meta: Meta<typeof SettingsSection> = {
    title: "UI/SettingsSection",
    component: SettingsSection,
};
export default meta;

type Story = StoryObj<typeof SettingsSection>;

// The quiet variant: a small brass label over a hairline. This is how every
// labelled group in the app announces itself when it is not a card.
export const Quiet: Story = {
    render: () => (
        <div className="flex flex-col gap-8">
            <SettingsSection title="Today">
                <p className="text-sm text-muted">Three moments, one at a time.</p>
            </SettingsSection>
            <SettingsSection title="How the sheet looks" hint="What is drawn on the staff.">
                <SwitchField label="Show finger numbers" checked={true} onChange={() => {}} />
            </SettingsSection>
        </div>
    ),
};

// With an icon it becomes a card: the icon in a soft chip, the title and hint
// beside it, the controls below.
export const Card: Story = {
    render: () => (
        <SettingsSection
            title="Your keyboard"
            hint="Which keys on the computer keyboard play which notes."
            icon={<KeysIcon className="h-5 w-5" />}
        >
            <SwitchField label="Use my own mapping" checked={false} onChange={() => {}} />
        </SettingsSection>
    ),
};

// The danger tone, for the one block that erases things.
export const Danger: Story = {
    render: () => (
        <SettingsSection
            title="Danger zone"
            hint="Erases everything this device has recorded. There is no undo."
            icon={<TrashIcon className="h-5 w-5" />}
            tone="danger"
        >
            <p className="text-sm text-muted">Progress, recordings and settings, all of it.</p>
        </SettingsSection>
    ),
};

// A quiet section nested inside a card. `level` keeps the document outline sound
// where that happens.
export const Nested: Story = {
    render: () => (
        <SettingsSection
            title="Your keyboard"
            hint="Which keys play which notes."
            icon={<KeysIcon className="h-5 w-5" />}
        >
            <SettingsSection title="Sustain" level={3}>
                <SwitchField label="Hold notes with the space bar" checked onChange={() => {}} />
            </SettingsSection>
        </SettingsSection>
    ),
};
