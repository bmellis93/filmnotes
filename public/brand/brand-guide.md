# FilmNotes brand guide

## Concept
The mark is built from viewfinder corner brackets, the crop guides you see on a camera monitor or video scope when framing a shot. A small dot sits in one corner, which doubles as a nod to a real projection term: the "cue mark" (sometimes called a cigarette burn) that flashes in the corner of a film frame to cue a projectionist to change reels. It fits neatly with what the app actually does, marking a specific point in a video for someone else to notice.

## Color

| Name | Hex | Use |
|---|---|---|
| Ink | `#0E0E11` | Primary dark background |
| Paper | `#F5F5F2` | Light surfaces, text on dark |
| Cue | `#F3A83E` | Primary accent: the cue mark itself, buttons, active states, links |
| Scope | `#2FA8A0` | Secondary accent only, for a second data series or a subtle highlight. Don't pair it with Cue at equal weight |
| Slate | `#8A8B93` | Muted text, borders, disabled states |

Rule of thumb: Ink carries the interface (this should feel like a dark app by default, with a light mode as the secondary surface, not the reverse). Cue marks the thing that needs attention. Scope stays in the background.

## Type

- **Geist**, with Inter as the fallback stack. One sans family, used at varying weights, no serif pairing. Semibold for the wordmark and headlines, regular or medium for UI, and Geist Mono (or a monospace fallback) for timecodes and any numeric display like `00:04:12:07`.
- Name is always written as FilmNotes, one word, capital F, capital N.

## Logo files

- `filmnotes-mark.svg`, icon alone, use as app icon, social avatar, loading state
- `filmnotes-favicon.svg`, simplified mark built for legibility at 16 to 32px
- `filmnotes-logo-light.svg`, full horizontal lockup for light backgrounds
- `filmnotes-logo-dark.svg`, full horizontal lockup for dark backgrounds (this is the primary version, since the product should feel dark-first)

## Notes on production

The wordmark is set with `font-family="Geist"`. If Geist isn't licensed or embedded wherever this file gets opened, it'll fall back to Inter, which is close enough in spirit but not identical, so convert the text to outlines in Figma before it goes anywhere outside the app (app store listing, print, etc).

For favicon.ico generation, run `filmnotes-favicon.svg` through a converter (for example realfavicongenerator.net) to get the full icon set (16px, 32px, apple touch icon, etc).

Minimum clear space around the mark is half its height on all sides. Keep the dot as the only saturated element in the mark itself, everything else in the icon stays neutral (Ink, Paper, Slate) so the cue mark is always the thing your eye lands on first.
