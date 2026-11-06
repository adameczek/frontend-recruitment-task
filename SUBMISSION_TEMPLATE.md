# Submission: [Your Name]

## Time Spent

Total time: **\_\_** (approximate)

## Ticket Triage

### Tickets I Addressed

List the ticket numbers you worked on, in the order you addressed them:

1. CFG-148: Fixed crash when deselecting "Include Packaging" - filtered out undefined add-ons and cleaned up dependent add-ons on option change.
2. CFG-142: Fixed price stuck at $0.00 — replaced the broken timestamp race-condition guard with an AbortController.
3. CFG-152: Accessibility - Can’t navigate with keyboard only - added keyboard support as without it a contract could have been breached.
4. CFG-143: App becomes sluggish after extended use - fixed the resize handler memory leak and made preview generation cancellable.
5. CFG-151: Error messages are too technical - mapped internal error codes to user-friendly, actionable messages and cleared stale error state.
6. CFG-149: Added loading indicator during price calculation.
7. CFG-156: Cleaned up list keys - replaced index/non-unique `name` keys with stable IDs.
8. CFG-157: Discard unsaved changes confirmation - added a `beforeunload` guard when dirty and a confirmation modal.

### Tickets I Deprioritized

List tickets you intentionally skipped and why:

| Ticket  | Reason                                                                                  |
| ------- | --------------------------------------------------------------------------------------- |
| CFG-158 | Already satisfied — `currentConfig` is already memoized and `product` is a stable prop. |
| CFG-XXX | [Why you skipped this]                                                                  |

### Tickets That Need Clarification

List any tickets where you couldn't proceed due to ambiguity:

| Ticket  | Question                                                                                                                                                                   |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CFG-145 | Conflicts with CFG-144 which says remove the Quick Add feature, while CFG-145 says improve it. Need a PM/product decision on which ticket wins before implementing either. |

### Tickets With a Misleading Priority Label

Our board labels aren't always right. List tickets where you disagreed with the label (e.g. a Low that's actually High, a High that's actually Low, a Medium that's actually Unclear) and explain why. If you didn't disagree with any, say so.

| Ticket  | Label on board | Your read             | Why                                                                |
| ------- | -------------- | --------------------- | ------------------------------------------------------------------ |
| CFG-152 | Low            | e.g. 🟠 High          | Possible breach of contract if we did not implement it before demo |
| CFG-158 | High           | ⚪ Low (already done) | Suggested fix is already in the code;                              |

### Tickets Where You Stopped to Ask Instead of Implementing

If a ticket was ambiguous enough that the right move was to escalate / ask PM / gather more context rather than ship a fix, list it here. We value this signal — picking one interpretation blindly and shipping it can cost more than stopping to ask.

| Ticket  | Who would you ask            | What you'd ask                                                                                                       |
| ------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| CFG-147 | Customer support / TechStyle | What browser and setup they use, plus a share URL from prod so I can reproduce it — I couldn't reproduce it locally. |

---

## Technical Write-Up

### Critical Issues Found

Describe the most important bugs you identified:

#### Issue 1: Crash when deselecting "Include Packaging"

**Ticket(s):** CFG-148

**What was the bug?**

Gift Wrap depends on include packaging, handleOptionChange cleans up addons only for type select, and include packaging is a toggle so gift wrap is left out.
Summary tries to get price of addon but fails because it's undefined and that's where error is thrown.

**How did you find it?**

First i replicated the bug, and then went to the dev console to check for errors.
I found uncaught TypeError in console so i went to ProductConfigurator.tsx where it was caused.
To get it quicker (As this component is pretty large) i used ai with brainstorming skill, where i also provided ticket description and error message. It helped me with finding the root cause.
"Include Packaging"

**How did you fix it?**

I filtered out undefined values in an Add-ons section in configuration.
I also made handleOptionChange remove addons whose requirements is no longer met for any option type (so like the comment in this event handler was described)

**Why this approach?**

I started with this bug as it was noted that it's a blocker, which is correct as this crashes whole application.

Filtering out undefined values in add ons selection is extra safety fix, just to be sure it wouldn't happen (better safe than sorry).
Fix in handleOptionChange was made so the code would comply with comment that was made here earlier.

---

#### Issue 2: CFG-142: Price never updates — stuck at $0.00

**Ticket(s):** CFG-142

**What was the bug?**
Price never updated because hook race condition guard compard two incompatible values. Date.now() was compared to mock api timestamp which returns incrementing requestId, since counter was always smaller the condition was always false.

**How did you find it?**
I reproduced the scenario, searched for code responsible for setting price as there was hint in description of issue "(Looks like a problem in how the hook decides when to apply a response.)".

**How did you fix it?**
I replaced the timestamp checking with AbortController. So each new fetchPrice call aborts the previous one.

**Why this approach?**

Race conditions should be fixed by cancelling the previous request instead of ignoring it. This also lowers the load on backend as there will be less requests to process.
I did not use useDebouncedPriceCalculation to still have cost quickly load without a delay from debounce, and abort controller guarantees latest response to be loaded.

---

#### Issue 3: Memory leak — resize handler never removed (app becomes sluggish over time)

**Ticket(s):** CFG-143

**What was the bug?**

The resize handling effect registered a listener on window but never removed it:

Because of no cleanup function listener leaked on every unmount.

**How did you find it?**

Ticket notes listed two areas, preview image generation or resize handling, and in ProductConfiguration Marcus left out text that it might have a leak. I have confirmed that the useEffect with event listener did not have cleanup.

**How did you fix it?**

1. Added a cleanup to the resize effect so the listener is removed on unmount.
2. Added AbortController for generate preview.

**Why this approach?**

Missing cleanup function in useEffect is a major issue, which every react dev should remember about.
Fix for this is also very easy, just add removeEventListener in cleanup.
I already implemented AbortController for pricing in CFG-142 so generate preview is consistent with rest of code.

---

### Other Changes Made

Brief description of any other modifications:

- In first ticket that i have done CFG-148 i had to make other fixes as eslint showed some errors.
  1. i had to fix empty catch statement in ProductConfigurator.tsx in line 210, where i set isValid to false in case of error.
  2. To avoid cascading renders i had to move out setIsDirty from line 258 to three mutation handlers (handleOptionChange, handleAddOnToggle, handleQuantityChange)
  3. To avoid cascading renders I moved share url generation out of effect to new handleOpenShareModal callback that the share button uses.
  4. To avoid cascading renders i deleted the mount only effect and moved the code to useState initializers.
- in second Ticket CFG-142
  1. I avoided cascading renders by removing setState inside useEffect. Price and error are now set in then and catch
  2. Removed unused `useDebouncedPriceCalculation`
  3. isLoading is no longer stored, it is now based on comparision of settled key to configKey
- in CFG-151
  1. Added `getUserFriendlyErrorMessage()` in `src/utils/errorMessages.ts` mapping internal codes (e.g. `ERR_PRICE_CALC_FAILED`, `VALIDATION_CONFLICT_47`) to friendly, actionable copy with a generic fallback.
  2. Replaced the raw `Error: {error || priceError}` render with the friendly message and removed the `.error-code` style.
  3. Cleared the `error` state at the start of each handler that can set it, so stale errors don't linger after a retry or selection change.
- in CFG-149 + CFG-156 (i made them together as both were small fixes)
  1. CFG-149: Applied Marcus's suggested fix
  2. CFG-156: Replaced unstable list keys with stable ids.

---

## Code Quality Notes

### Things I Noticed But Didn't Fix

List any issues you noticed but intentionally left:

| Issue | Why I Left It |
| ----- | ------------- |
|       |               |

### Potential Improvements for the Future

If you had more time, what would you improve?

1. [Improvement 1]
2. [Improvement 2]

---

## Questions for the Team

Questions you would ask in a real scenario:

1. why is there useDebouncedPriceCalculation that's not used anywhere?
2. [Question 2]

---

## Assumptions Made

List any assumptions you made to proceed:

1. [Assumption 1]
2. [Assumption 2]

---

## Self-Assessment

### What went well?

[Your reflection]

### What was challenging?

[Your reflection]

### What would you do differently with more time?

[Your reflection]

---

## AI Assistance Notes (optional)

If you used AI tools (Copilot, Claude, Cursor, ChatGPT, etc.), we'd love a short note on how. **We don't score the fact that you used AI — we score the quality of your reasoning and verification.**

Useful things to share:

- What kinds of prompts you sent (paraphrase is fine, no need to paste logs)
- Where the AI helped and where you overrode it
- Anything the AI suggested that you rejected — and why
- Anything you verified manually that the AI got wrong

- I have used brainstorming skill with text from the tickets to help me quickly get into the issues. The codebase was quite large which would take me longer time to understand.

- For ticket CFG-142 ai suggested just fixing the system for checking for stale responses. I decided that way better option would be to implement AbortController as it's modern and standard React practice.

---

## Additional Notes

Anything else you want us to know:

[Your notes]
