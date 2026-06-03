import { ImageResponse } from "next/og";
import { LANDING_SEO } from "@/lib/seo-content";
import { SITE_NAME } from "@/lib/site";

export const alt = `${SITE_NAME} — walking and hiking app`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Default social share image (1200×630).
 * Replace this file with a static public/og/rambleio-og.png if you prefer a designed asset.
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "linear-gradient(135deg, #1b5e20 0%, #2e7d32 40%, #1a237e 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              opacity: 0.85,
            }}
          >
            {SITE_NAME}
          </div>
          <div
            style={{
              fontSize: 56,
              fontWeight: 800,
              lineHeight: 1.15,
              maxWidth: 900,
            }}
          >
            {LANDING_SEO.h1}
          </div>
        </div>
        <div
          style={{
            fontSize: 28,
            lineHeight: 1.4,
            opacity: 0.92,
            maxWidth: 880,
          }}
        >
          Route planning · Off-path alerts · GPS recording · Offline maps
        </div>
      </div>
    ),
    { ...size },
  );
}
