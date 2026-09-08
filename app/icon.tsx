import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

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
          background: "#1c5b40",
          borderRadius: 7,
        }}
      >
        <div style={{ display: "flex", color: "#f7f2e9", fontSize: 19, fontWeight: 700 }}>e</div>
      </div>
    ),
    { ...size }
  );
}
