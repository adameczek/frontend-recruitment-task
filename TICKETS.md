# Backlog: ProductConfigurator

These tickets were pulled from our Jira board. They're in rough priority order based on the last sprint planning, but use your judgment—some priorities may have changed.

## Priority legend

| Tier        | Meaning                                   |
| ----------- | ----------------------------------------- |
| 🔴 Critical | Blocks the demo                           |
| 🟠 High     | Visible impact, needs attention           |
| 🟡 Medium   | Polish, quality                           |
| ⚪ Low      | Nice-to-have                              |
| 🧪 Unclear  | Ambiguous scope / conflicting information |

> **Heads-up:** these labels reflect what was on the Jira board. They don't always reflect true priority — the board is maintained by a busy, imperfect team. Read each ticket's description carefully and use your own judgment. If a label and a description disagree, flag it in your submission.

---

## 🔴 CFG-142: Price never updates — stuck at $0.00

**Reporter:** Customer Success (Jamie)
**Created:** 3 days ago

### Description

Multiple customers report that the displayed price is stuck at `$0.00` (or the placeholder) even though the Network tab clearly shows price requests firing. Occasionally the real price flashes for a split second and then snaps back to zero. Looks like a problem in how the hook decides when to apply a response.

### Steps to Reproduce

1. Open the configurator with any product
2. Change any option (size, color, material, quantity)
3. Observe the price display — it stays at `$0.00` / placeholder
4. In Network tab: price requests are firing and returning real values
5. Occasionally a correct price flashes briefly, then reverts to `$0.00`

### Customer Quote

> "I picked my size, color, quantity — everything. Total still says $0.00. Tried refreshing, tried different products. Same thing. I can see the page doing _something_ when I click, but the number never changes."

### Notes

This is blocking for the TechStyle demo. They configure high-volume orders — a broken total number is a hard no-go.

---

## 🟠 CFG-143: App becomes sluggish after extended use

**Reporter:** QA (Alex)
**Created:** 5 days ago

### Description

During testing sessions, the configurator becomes noticeably slower after 15-20 minutes of use. Browser dev tools show steadily increasing memory usage over time.

### Steps to Reproduce

1. Open the configurator
2. Make various configuration changes over ~20 minutes
3. Resize the browser window several times during the session
4. Notice increasing lag in UI responses

### Notes

Hard to reproduce consistently — only shows up after sustained use. Might be related to preview image generation, or to the resize handling for responsive layout. Not sure which.

---

## 🟠 CFG-144: Remove the "Quick Add" feature

**Reporter:** Product (Sarah)
**Created:** 1 week ago

### Description

Per discussion in the product sync, we've decided to sunset the Quick Add feature. It's confusing users and the analytics show only 2% usage.

Please remove the Quick Add button and all related code.

### Acceptance Criteria

- Quick Add button should not be visible
- Related state and handlers should be removed
- No console errors after removal

---

## 🟠 CFG-145: Improve Quick Add feature with keyboard shortcut

**Reporter:** Customer Success (Jamie)
**Created:** 4 days ago

### Description

Enterprise customers love the Quick Add feature! TechStyle specifically asked if we can add a keyboard shortcut for it (Ctrl+Enter or similar).

### Customer Quote

> "The Quick Add feature is a huge time saver for our team. Would be even better with a hotkey."

### Notes

This came from the TechStyle account review. TechStyle's PM explicitly confirmed on the call that the hotkey is **mandatory** for the upcoming demo — they want to showcase it.

---

## 🟡 CFG-146: "Last saved" timestamp shows wrong time

**Reporter:** QA (Alex)
**Created:** 2 days ago

### Description

The "Last saved at" timestamp in the draft saving feature shows times that are off by several hours for some users.

### Steps to Reproduce

1. Save a draft configuration
2. Note the displayed "Last saved at" time
3. Compare with actual current time

### Notes

Seems to happen for users not in UTC timezone. Low priority since it's just cosmetic, but might confuse users.

---

## 🔴 CFG-147: Share link broken for some configurations

**Reporter:** Customer Success (Jamie)
**Created:** 6 days ago

### Description

Some customers report that shared configuration links don't work. When clicked, they either show an error or load the wrong configuration.

### Steps to Reproduce

Unable to reproduce consistently. Customer provided this example configuration that breaks:

- Size: 10" Large
- Color: Blue (Custom #3)
- Quantity: 5
- Configuration name: "Żółć test 🎨"

### Notes

The customer's configuration name includes special characters (Polish diacritics, emoji). Not sure if that's related. Jamie has the customer's contact if we need more info.

Marcus mentioned on Slack that this definitely worked on prod about a month ago — it might be a dev-only flake related to our local build setup rather than a real production issue. Worth verifying before sinking time into it.

---

## 🔴 CFG-148: Crash when deselecting "Include Packaging"

**Reporter:** QA (Alex)
**Created:** 1 day ago

### Description

The configurator crashes completely when you deselect "Include Packaging" after selecting certain options.

### Steps to Reproduce

1. Start a new configuration
2. Select "Premium Material" upgrade
3. Check "Include Packaging"
4. Select "Gift Wrap" add-on (which requires packaging)
5. Uncheck "Include Packaging"
6. **CRASH** - white screen, console shows React error

### Error Message

```
Cannot read properties of undefined (reading 'price')
```

### Notes

This is a blocker. We can't ship with a crash bug.

---

## 🟡 CFG-149: Add loading indicator during price calculation

**Reporter:** UX (Morgan)
**Created:** 1 week ago

### Description

When the price is being calculated (after changing options), the old price stays visible. This could confuse users into thinking their selection didn't change anything.

### Acceptance Criteria

- Show a subtle loading state while price is being calculated
- Could be a spinner, skeleton, or just dim the price text

### Notes

Nice to have for polish. The price calculation is usually fast enough that it might not be noticeable.

Marcus left a note in the team doc with a suggested fix: wrap the price display like `<span>{isPriceLoading ? '...' : formattedTotal}</span>` — should be enough, no need to overthink it.

---

## 🟡 CFG-150: Fix the CSS alignment on the color picker

**Reporter:** UX (Morgan)
**Created:** 3 days ago

### Description

The color picker swatches are misaligned on mobile viewports. The last row wraps awkwardly.

### Attached Screenshot

[screenshot_mobile_colors.png - not available in this export]

### Notes

Morgan mentioned this is actually a JavaScript issue with how we calculate the grid, not CSS. Something about the column count calculation.

---

## 🟡 CFG-151: Error messages are too technical

**Reporter:** Customer Success (Jamie)
**Created:** 2 days ago

### Description

When something goes wrong, users see technical error codes like "ERR_PRICE_CALC_FAILED" or "VALIDATION_CONFLICT_47". These mean nothing to end users.

### Customer Quote

> "I got an error that said 'ERR_NETWORK_TIMEOUT_PRICE'. I have no idea what that means or what to do about it."

### Acceptance Criteria

- Error messages should be user-friendly
- Include actionable next steps (e.g., "Please try again" or "Contact support")

---

## ⚪ CFG-152: Accessibility - Can't navigate with keyboard only

**Reporter:** QA (Alex)
**Created:** 4 days ago

### Description

Users who rely on keyboard navigation cannot fully use the configurator. Some elements are unreachable without a mouse.

### Affected Areas (from audit)

1. Color picker swatches not focusable
2. Quantity increment/decrement buttons missing focus styles
3. After closing a modal with Escape, focus goes to body instead of trigger
4. Custom dropdown options not navigable with arrow keys

### Notes

Flagged as part of the WCAG 2.1 AA audit the QA team is prepping. TechStyle's MSA includes accessibility compliance clauses — if we ship the demo without keyboard navigation working, we're arguably in breach of contract. Board still has this as Low because it was filed before Legal flagged the compliance angle.

---

## 🟡 CFG-153: Implement "Compare Configurations" feature

**Reporter:** Product (Sarah)
**Created:** 1 week ago

### Description

As discussed with the enterprise team, we need to add the ability to compare two saved configurations side-by-side.

### User Story

As a buyer, I want to compare two configurations so that I can decide which option better fits my needs.

### Acceptance Criteria

- User can select two saved configurations
- Side-by-side view shows differences highlighted
- Price difference should be prominently displayed

### Notes

This is a significant feature. Estimate was 2-3 weeks. Not sure why it's in this sprint.

---

## 🧪 CFG-154: Quantity discount not applying correctly

**Reporter:** Customer Success (Jamie)
**Created:** 2 days ago

### Description

The quantity discount tiers seem to be off by one. Users need to enter 51 items to get the "50+ items" discount.

### Steps to Reproduce

1. Configure any product
2. Set quantity to exactly 50
3. Notice the discount doesn't apply
4. Change to 51, discount appears

### Notes

This is messy. There are two conflicting stories floating around:

- **Marketing page + public docs** say "50+ items get 15% off" — so the customer expectation (and CS's expectation) is that qty 50 triggers the discount.
- **Sarah's Slack message last week** suggested the current `>` behavior (51+) is intentional, because "that's how our pricing engine was designed" — but she was half-asleep writing it, and on re-read she may have been talking about a _different_ threshold tier entirely. Nobody has found the original pricing spec.

Both directions carry financial risk: if the public docs are right and we leave it at 51+, we're shortchanging customers who qualify for the discount. If Sarah's Slack is right and we change to `>=`, we start giving discounts we shouldn't, which hits margin on high-volume orders.

Nobody has escalated this to PM/Finance yet. Do what you think is right.

---

## ⚪ CFG-155: Add dark mode support

**Reporter:** Product (Sarah)
**Created:** 2 weeks ago

### Description

Several customers have requested dark mode support. Our widget should respect the parent site's color scheme.

### Acceptance Criteria

- Detect `prefers-color-scheme` media query
- Alternatively, accept a `theme` prop from parent
- All colors should have dark mode variants

### Notes

Nice to have. Would be great for the TechStyle demo since their site uses dark mode, but not critical.

---

## 🟡 CFG-156: Console warnings about missing keys in lists

**Reporter:** QA (Alex)
**Created:** 5 days ago

### Description

React dev tools shows warnings about missing `key` props in several list renders. Not causing visible issues but should be cleaned up.

### Locations Noted

- Option list rendering
- Color swatch mapping
- Add-on checkboxes

---

## 🟡 CFG-157: Discard unsaved changes confirmation

**Reporter:** UX (Morgan)
**Created:** 1 week ago

### Description

When a user has unsaved changes and tries to navigate away or close the configurator, they should get a confirmation dialog. Currently, changes are silently lost.

### Acceptance Criteria

- Detect when there are unsaved changes
- Show confirmation dialog on close/navigate
- "Save & Close" and "Discard" options

### Notes

Standard UX pattern. Surprised we don't have this already.

---

## 🟠 CFG-158: Performance - memoize props in ProductConfigurator

**Reporter:** Engineering (Marcus)
**Created:** 2 days ago

### Description

Profiling showed unnecessary re-renders in the `ProductConfigurator` tree. The `product` and `currentConfig` props are recomputed every render, which cascades down into child components and hooks.

### Suggested Fix (from Marcus's notes)

> Wrap `product` and `currentConfig` in `useMemo` at the top of `ProductConfigurator`. Should cut render count roughly in half based on my React DevTools Profiler run. Low risk, high win.

### Acceptance Criteria

- `product` and `currentConfig` memoized
- Profiler confirms fewer re-renders
- No visible regression in behavior

### Notes

Flagged as High because the demo machine is underpowered and the TechStyle team will definitely notice UI lag. Marcus has already sketched the fix — should be a quick win.
