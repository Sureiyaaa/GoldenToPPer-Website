# Customer Inbox scrolling correction

Verified on October 7, 2026 with headless Chrome, the actual Customer Inbox component/provider, generated Tailwind CSS, and the application's cached Poppins font. Notification fetches and Supabase realtime are mocked with local fixtures; these checks do not read or write customer records.

The follow-up removes the bottom result-summary row entirely. Only the total/unread counters near the page title remain; no pagination replaces the footer. The records card is the Inbox's final element, saving the former summary's 16px height and 12px top margin.

## Observed cause and previous scroll owner

The current checkout did not reproduce the reported live result of all seven rows being visible. The attached request contained text only, without the referenced screenshot or an authenticated browser session. The live discrepancy therefore remains unconfirmed; it would be inaccurate to claim that `flex-1` defeated an applied `max-height`.

The original structure and measured geometry at 1440×900 were:

| Element | Original rules | Measured behavior with seven fixture records |
| --- | --- | --- |
| Dashboard shell | `h-screen overflow-hidden` | 900px high; document did not scroll. |
| Main | `flex flex-col flex-1 overflow-hidden` | Allocated the remaining height below its 80px header. |
| Dashboard content | `min-h-0 flex-1 overflow-hidden` for Inbox | 820px high, with vertical padding. |
| Inbox root | `flex flex-col`, inline `minHeight: 0`; no `h-full` | Auto-sized to 761px of content rather than the dashboard's available height. |
| Records card | `min-h-0 flex-1 flex-col overflow-hidden` | 450px high including borders; flex growth did not define a row viewport. |
| Table wrapper | `max-h-[28rem] overflow-y-auto` | **Actual scroll owner:** 448px client height, 614px scroll height. The generated CSS and computed max-height both confirmed that the rule applied. |
| Table | Native, fixed columns, natural row sizing | 614px tall; growing inside the wrapper was normal table behavior. |
| Header | Sticky, padded cells | 47.5px high. |
| Body rows | `py-5`, wrapping sender/email/context | Approximately 81px each; height could also vary with content. |
| Footer | Root sibling after the card, `shrink-0` | Outside the scrolling records, but the auto-height root could put it below a short dashboard's visible area. |

The verified failure was the five-row contract: 448px minus the 47.5px header leaves 400.5px, which is too little for five approximately 81px rows. Chrome showed four complete rows and part of the fifth. A maximum height also supplied neither a fixed desktop height nor a stable row height. Removing the records card's `flex-1` and giving the root its proper desktop height fixes those independent layout weaknesses.

## Final structure and dimensions

The native semantic table is retained, including its caption, column group, column headers and `scope="col"`. Header and body share the same table, preserving column alignment.

```text
dashboard shell (viewport height)
  main
    dashboard header (80px, shrink-0)
    dashboard content (min-h-0, flex-1; desktop overflow-hidden)
      Inbox section (desktop h-full, min-h-0, flex, flex-col)
        title / description / counters (shrink-0)
        filters (shrink-0)
        optional existing notices (shrink-0)
        records card (shrink-0, overflow-hidden; no flex-grow)
          scrollRef region (desktop h-[408px], overflow-y-auto)
            native table
              sticky opaque header (48px)
              tbody (72px per row)
```

The exact desktop height is **408px = 48px header + 5 × 72px rows**. The bordered card is 410px high. Desktop cells use 12px vertical padding; sender and email remain two bounded lines, and subject/date content is limited to two lines. Long sender/email text is visually truncated, with full text retained in the DOM, tooltip and existing detail dialog. The separate table border model avoids fractional collapsed borders; each row's bottom border is included in its 72px height. Rendered geometry confirms these dimensions, including long content and untracked status at 1024px width.

Desktop title/filter spacing is slightly tighter and the empty notice wrapper no longer reserves a margin. All controls and five complete rows fit at 1024×768 and 1366×768, with additional room from removing the bottom summary.

## Verified counts and counters

| Record count | Desktop result |
| --- | --- |
| 0 | Existing empty state and top counters showing zero total/unread records. |
| 1–4 | All available rows visible; no internal scrolling needed. The explicit records viewport stays 408px. |
| 5 | Exactly five complete rows; no overflow. |
| 6 | Five complete rows; row six starts exactly at the viewport's lower boundary and is reachable internally. |
| 7 | Five complete rows; rows six and seven are reachable internally. |
| 20 and 50 | Five complete rows at a time; viewport remains 408px and the last row is reachable internally. |

The header and records card stay at the same screen coordinates during internal scrolling. Tests verify the top total/unread counters for every count, the absence of the bottom summary, and that the records card ends the Inbox. No pagination was added.

## Input, refresh and responsiveness

The records region retains `overflow-y-auto`, `overscroll-contain`, `scrollbar-width: none`, and the hidden WebKit scrollbar. Wheel input and small trackpad-style wheel deltas scroll the records; wheel events at the boundary do not move the dashboard. The region is named and keyboard-focusable, has a visible inset focus ring, and supports native PageDown/End scrolling. Tab reaches an initially offscreen Open button and scrolls it into view below the sticky header; 48px desktop scroll padding protects that focus position. Mobile touch swipes scroll the original stacked cards.

These input checks use Chrome DevTools event emulation, rather than physical mouse, trackpad or touch hardware.

The existing `scrollRef` resets to zero when search, type or read-status filters change, or when record contents/order/count materially change. A comparison of record contents replaces the loading-state trigger, so an identical refresh preserves position. Tests cover a changed field with an unchanged count, an inserted record and an unchanged refresh. Fetching, normalization, read tracking, RBAC, routing and schema are unchanged.

At widths below 1024px, the existing stacked cards remain in a region bounded by `min(28rem, 60dvh)`. The Inbox dashboard content permits outer scrolling so controls and records remain accessible. Screens shorter than 768px also allow outer scrolling; the desktop table still retains its five-row records boundary. Existing error/live-update notices permit outer scrolling when needed, avoiding clipped notices or records. These overflow rules apply only when Customer Inbox is selected.

Checked layouts: 1024×768, 1366×768, 1440×900, 1920×1080, 1366×600, 768×1024, 375×667 and 375×400. The four ordinary desktop sizes have no vertical dashboard/document scrolling; smaller/shorter layouts have accessible outer scrolling without horizontal page overflow.

## Validation and artifacts

The footer-removal follow-up reran all 15 Customer Inbox checks successfully. Build, full-suite, lint and type-check results below are from the initial scrolling correction.

- `npm.cmd run build`: passed. The repository already sets `typescript.ignoreBuildErrors: true`, so this is a compilation/build check, not a successful full type check.
- Customer Inbox model/action regression tests: 14 passed.
- Browser geometry/input regression: passed after footer removal, including top counters, summary absence, count, long-content, scrolling, focus, filter, refresh, responsive and notice/error cases above.
- Full regression suite: 39 passed, 2 failed. Both failures also occurred before this change in `tests/loan-preapplication.test.cjs`; their existing client-submit harness throws `ReferenceError: setErrorMessage is not defined`.
- Targeted lint is blocked by the existing `eslint-config-next/core-web-vitals` module resolution failure.
- Full `tsc --noEmit --incremental false` is blocked by the existing missing `mapbox__point-geometry` type definition.
- `git diff --check`: passed.

Run the browser regression with `node --test tests/customer-inbox-scroll.test.cjs`. It uses installed Next/Tailwind dependencies and a local Chromium executable; set `CHROME_PATH` if necessary. Without Chromium it explicitly skips the browser case. Cached application fonts are used when `.next/static` is available. Generated bundles, metrics, profiles and screenshots live under ignored `.cache/inbox-scroll/`.

Local review artifacts:

- [Original fixture layout](../.cache/inbox-scroll/before.png)
- [Corrected 1366×768 desktop layout](../.cache/inbox-scroll/after-1366x768.png)
- [Corrected 1024×768 desktop layout](../.cache/inbox-scroll/after-1024x768.png)
- [375×667 cards after outer scrolling](../.cache/inbox-scroll/after-375x667.png)
- [Measured record counts and responsive results](../.cache/inbox-scroll/results.json)

These are local fixture screenshots, not captures of production customer data or the missing supplied reference screenshot.
