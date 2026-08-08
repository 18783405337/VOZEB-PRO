import type { Metadata } from "next";

import { SmartClipWorkspace } from "./smart-clip-workspace";

export const metadata: Metadata = {
    title: "Smart Clip",
    description: "Create and track smart clip tasks.",
};

export default function SmartClipPage() {
    return <SmartClipWorkspace />;
}
