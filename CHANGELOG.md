# Changelog

## v0.20.0 — Markdown summary
- Hero gains a “copy summary” action that produces a paste-ready Markdown block
  (status icons, phase list, time left, round counter).

## v0.19.0 — Filter and search
- All / Active / Open segmented filter plus a search box over id, title and summary.
- `/` focuses the search box; the list header shows `shown / total`.

## v0.18.0 — English README
- Full `README.en.md`, language switch in the Chinese README, stale sections fixed.

## v0.17.0 — Cleanup
- Removed the retired rail / chapter / distance / cards styles (CSS 12% smaller).

## v0.16.0 — Malformed configs and empty state
- Invalid dates, missing ids, non-array `phases` and out-of-range progress are normalised.
- Empty state ships a copyable `board.config.json` example.

## v0.15.0 — Large-session performance
- `tool/result` lines are filtered out before `JSON.parse`.
- Benchmark: 9.5 MB / 20k events, cold ~25 ms, warm < 1 ms.

## v0.14.0 — Timeline zoom
- Focus now / 6h / 24h / All presets; the view re-centres when “now” leaves the window.

## v0.13.0 — Deep links
- `#P3` permalinks, copy-link button, reversed timestamps collapse to zero length.

## v0.12.0 — Chinese and English UI
- Every user-facing string in a dictionary; `?lang=` override.

## v0.11.0 — Accessibility
- Focusable bars with ARIA labels, focus restoration, contrast raised to ≥ 4.5:1.

## v0.10.0 — Narrow panels
- Compact header under 900px, clipped plan bars, narrower label column.

## v0.9.0 — Hero-first layout
- Current phase, four key numbers and a progress bar replace the metric wall.

## v0.8.0 — Focus-now window and reusable phases
## v0.7.0 — Inline panel, skeleton, error retry, light theme
## v0.6.0 — Renamed to `dsh-goal-gantt`
## v0.1.0 — First public release
