import { DashboardHeader } from "@/components/dashboard-header";
import { PaceProvider } from "@/components/pace-context";
import { PreviewProvider } from "@/components/preview-context";
import { noIndexMetadata } from "@/lib/metadata";
import type { Metadata } from "next";

export const metadata: Metadata = noIndexMetadata;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    /**
     * Full-screen shell. The MapCanvas is rendered once here and stays mounted
     * at all times. All route-level content is layered on top via `children`.
     */
    <PreviewProvider>
      <PaceProvider>
      <div className="relative h-screen w-screen overflow-hidden">
        {/* ── Top navigation bar ── */}
        <DashboardHeader />

        {/* ── Route overlays (rendered on top of map, below nav) ── */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          <div className="relative w-full h-full pointer-events-none">
            {children}
          </div>
        </div>
      </div>
      </PaceProvider>
    </PreviewProvider>
  );
}

