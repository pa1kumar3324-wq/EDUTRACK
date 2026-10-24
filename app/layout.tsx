import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { Toaster } from "sonner";

// Self-hosted fonts (fontsource) — ships the actual font files as static assets so the
// production build never depends on reaching fonts.googleapis.com/fonts.gstatic.com at
// build time. Also shaves a render-blocking external request off every real page load.
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "EduTrack",
  description:
    "Continuity tracking for NGO tutoring programs. Volunteers see what a child learned last and what's next.",
  manifest: "/manifest.json",
  appleWebApp: { title: "EduTrack", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1eee7" },
    { media: "(prefers-color-scheme: dark)", color: "#10100f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {children}
          <Toaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              classNames: {
                toast: "!bg-card !text-card-foreground !border-border !shadow-soft-lg !rounded-xl",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
