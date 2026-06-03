import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Apple touch icon — replace with a branded asset when ready. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2e7d32",
          color: "white",
          fontSize: 96,
          fontWeight: 800,
          fontFamily: "system-ui, sans-serif",
          borderRadius: 32,
        }}
      >
        R
      </div>
    ),
    { ...size },
  );
}
