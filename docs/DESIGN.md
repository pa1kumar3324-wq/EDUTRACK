# EduTrack design system

EduTrack is an independent product created by Emporum. Its look follows Emporum's design language;
nothing else is shared (no code, data, auth or features).

## Source and what was kept
Derived from Emporum's site implementation: obsidian ground, warm ivory text, restrained gold, Manrope only,
hairline borders, pill buttons, 20px cards, tight headings, a gold rule that draws in on card hover.
Kept as identity: palette, type, pills, hairlines, depth. Left on the marketing site: hero, cursor glow,
3D card tilt, scroll reveals. Film grain and halo rings appear on sign-in screens only.

## Tokens (`app/globals.css`, `tailwind.config.ts`)
- **Dark** is the native Emporum palette (`#10100f` ground, `#f1eee7` text, `#ead6a6` primary, `#c7a76b` accent).
- **Light** is built from Emporum's inverted ivory section: `#f1eee7` paper, `#141411` ink, deepened gold `#7a5c25` / `#7f6329`.
- Success, warning and destructive do not exist in Emporum. They are EduTrack additions tuned to the same neutrals.
- `--radius: 0.75rem` (cards `rounded-xl` = 20px, dialogs `rounded-2xl`). Buttons, tabs and nav items are pills.
- Shadows come from `--shadow-soft` / `--shadow-lift`, so light mode gets a gentler ink shadow.
- `gold-50…900` ramp replaces the old unused `forest` / `clay` scales (for data viz).

## Accessibility
Computed WCAG ratios: body text 16.4:1 dark / 15.9:1 light; muted text 7.3:1 / 6.7:1 on cards;
primary as text 12.5:1 / 5.8:1; semantic colours ≥ 4.9:1 as text; form-control borders ≥ 3.3:1 against
both backgrounds. Focus rings are always visible. Status is never colour alone (icon + label, unchanged).
All motion respects `prefers-reduced-motion`.

## Attribution (`lib/brand.ts`, `components/brand/EmporumAttribution.tsx`)
Footer: "EduTrack · Built by Emporum". Sign-in screens: "An education product by Emporum".
The destination comes from `NEXT_PUBLIC_EMPORUM_URL` (https only). If unset or invalid, the name is plain text,
so a wrong or placeholder link can never ship. Set it per deployment.
