import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

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
          background: "linear-gradient(135deg, #1c5b40 0%, #123c29 100%)",
        }}
      >
        <div style={{ display: "flex", color: "#f7f2e9", fontSize: 96, fontWeight: 700 }}>e</div>
      </div>
    ),
    { ...size }
  );
}
