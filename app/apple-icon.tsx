import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// EduTrack's stepped-bar mark on Emporum obsidian (see components/brand/TrackMark.tsx)
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
          background: "#10100f",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16 }}>
          <div style={{ width: 52, height: 22, borderRadius: 11, background: "#f1eee7" }} />
          <div style={{ width: 80, height: 22, borderRadius: 11, background: "#f1eee7" }} />
          <div style={{ width: 104, height: 22, borderRadius: 11, background: "#c7a76b" }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
