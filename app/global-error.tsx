"use client";

import { useEffect } from "react";

// This boundary only fires when the root layout itself throws, so it deliberately
// avoids ThemeProvider, custom fonts, and Tailwind's design tokens — anything that
// could plausibly be what broke — and renders with plain inline styles instead.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Global error boundary caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          fontFamily: "system-ui, sans-serif",
          background: "#f7f2e9",
          color: "#241a0d",
          padding: 24,
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>EduTrack hit a problem</h1>
        <p style={{ maxWidth: 360, color: "#6b5f4f", fontSize: 14 }}>
          The app failed to load. Try reloading — if this keeps happening, let an admin know.
        </p>
        {error.digest && <p style={{ fontSize: 12, color: "#a89a84" }}>Reference: {error.digest}</p>}
        <button
          onClick={() => reset()}
          style={{
            padding: "8px 16px",
            borderRadius: 10,
            border: "none",
            background: "#1c5b40",
            color: "#f7f2e9",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
