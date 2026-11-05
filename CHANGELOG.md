# Changelog

## v0.29.0 — Outcomes, not tool ledgers
- Project segments no longer print tool counts (“edited ×4 · ran ×3”).
- Each segment now carries the outcome sentence extracted from its last assistant reply.
- Hero stats switch to segment time / phases / span / active time.

## v0.28.0 — Conversation as a project
- Sessions without a goal now render an auto-generated project view instead of an empty state.
- Segments are cut by 20-minute idle gaps; titles come from the first user message in each segment.
- Each segment counts edits/commands/reads/turns; the hero swaps progress for tool calls, phases and span.
- Project mode defaults to the full time range and leaves headroom right of “now”.

## v0.26.0 — Create the example config
- Empty state gets a “Create example config” button backed by `POST /api/goal-gantt/init`.
- The route only writes `<workspace>/goal-board/board.config.json`, uses exclusive create (`wx`), and returns 409 when a config exists.
- Privacy section documents this as the single write operation.

## v0.25.0 — CSV export
- Hero gains an “Export CSV” action: id, title, status, progress, planned/actual times, duration, segments, checks and summary.
- The file is UTF-8 with BOM so Excel opens Chinese text correctly.

## v0.24.0 — Shareable filters
- Filter and search state is mirrored into the URL (`?q=…&f=…`) and restored on load.
- Copied deep links carry the active filter and query.
- Fixed: filter button labels and the search placeholder were not localised.

## v0.23.0 — Big boards
- Each status group renders at most 40 rows; the rest fold behind a “show more” button.
- The session list is cached for 3 s instead of rescanning on every request.

## v0.22.0 — Status groups
- Phase list is grouped into In progress / Not started / Blocked / Done.
- The Done group is collapsed by default; group state persists in localStorage.

## v0.21.0 — Relative times and expansion memory
- Phase rows show “5h ago” or “2h36m in”.
- Expanded phases persist in localStorage.

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
