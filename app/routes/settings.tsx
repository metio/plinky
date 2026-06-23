import type { Route } from "./+types/settings";
import { MidiDebugPanel } from "../components/midiDebugPanel";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Plinky - Settings" },
    { name: "description", content: "Configure Plinky" },
  ];
}

export default function Settings() {
  return <MidiDebugPanel />;
}
