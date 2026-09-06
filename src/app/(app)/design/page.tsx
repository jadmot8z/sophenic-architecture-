import { DesignWorkspace } from "@/components/design/design-workspace";

export const metadata = { title: "SOPHENIC Design — Sophenic" };

export default function DesignPage() {
  return <div className="h-[calc(100vh-3.5rem)] min-h-[680px] lg:h-screen"><DesignWorkspace /></div>;
}
