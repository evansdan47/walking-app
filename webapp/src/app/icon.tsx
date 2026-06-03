import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Browser tab favicon — replace with a branded asset when ready. */
export default function Icon() {
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
          fontSize: 22,
          fontWeight: 800,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        R
      </div>
    ),
    { ...size },
  );
}
