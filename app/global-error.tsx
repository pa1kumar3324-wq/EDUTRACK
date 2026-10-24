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
          fontFamily: "Manrope, system-ui, Arial, sans-serif",
          background: "#10100f",
          color: "#f1eee7",
          padding: 24,
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.03em" }}>EduTrack hit a problem</h1>
        <p style={{ maxWidth: 360, color: "#aaa598", fontSize: 14 }}>
          The app failed to load. Try reloading. If this keeps happening, let an admin know.
        </p>
        {error.digest && <p style={{ fontSize: 12, color: "#8d887c" }}>Reference: {error.digest}</p>}
        <button
          onClick={() => reset()}
          style={{
            padding: "10px 22px",
            borderRadius: 999,
            border: "none",
            background: "#ead6a6",
            color: "#171611",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
