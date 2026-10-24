import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// EduTrack's stepped-bar mark on Emporum obsidian (see components/brand/TrackMark.tsx)
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
          background: "#10100f",
          borderRadius: 7,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3 }}>
          <div style={{ width: 9, height: 4, borderRadius: 2, background: "#f1eee7" }} />
          <div style={{ width: 14, height: 4, borderRadius: 2, background: "#f1eee7" }} />
          <div style={{ width: 18, height: 4, borderRadius: 2, background: "#c7a76b" }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
