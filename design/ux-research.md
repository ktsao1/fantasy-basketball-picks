# UX research: visual hierarchy and explainable recommendations

2026-11-20. Input for the Figma designs (Phase 3). It pulls together research on decision-support and explainable-AI UX and a survey of comparable products on Mobbin. It ends with the visual hierarchy rules the designs should follow.

**The design problem.** The engine already attaches an action, a payoff, a reason and a confidence to every recommendation. The unstyled dashboard prints the reason as one sentence of prose. The design has to make that reasoning visible at a glance, so that a pickup *looks like* "two games vs. one, and better recent form" before anyone reads a word.

---

## Theory that applies

| Source | What it says | What it means here |
|---|---|---|
| **Shneiderman's mantra**: "overview first, zoom and filter, then details on demand" | Lay out information in tiers, so detail costs a click instead of attention. | Each recommendation has three tiers: the verdict, then the top reasons, then the full stat comparison. |
| **Microsoft HAX Guideline 11**: "make clear why the system did what it did" ([HAX](https://www.microsoft.com/en-us/haxtoolkit/library/pattern/)) | The patterns it names include *local explanations*, *mapping input attributes to outputs* and *"what if?"* explanations. | Each pickup gets a local explanation that maps inputs (games left, recent form, minutes) to the output (fpts gained). |
| **Google PAIR, Explainability + Trust** ([chapter](https://pair.withgoogle.com/chapter/explainability-trust/)) | Calibrate trust, don't maximize it. How confidence is shown shapes decisions. Say what the system can't do. | Confidence is a calibrated signal with a stated basis, not a badge of approval. Low confidence changes how the card looks and what it tells you to do. |
| **Contrastive explanation** (Miller, cited in [Liao et al., "Questioning the AI"](https://arxiv.org/pdf/2001.02478)) | People ask "why X *rather than* Y?", not "why X?". | A pickup is a *swap*. Explain it as add vs. drop on the same measures, not as the added player's merits alone. |
| **Feature attribution is the most understood format** ([EUCA, 2021](https://arxiv.org/pdf/2102.02437)) | Participants understood ranked feature contributions without help, and it ranked near the top of the explanation formats tested. Suggested variants show only the ranking, with scores on demand. | Show the reasons as a ranked list of factors with their contribution in fpts, not as a sentence. |
| **Uncertainty visualization** ([Kay et al., "When(ish) is my bus?"](https://idl.uw.edu/papers/uncertainty-bus); [Fernandes et al., CHI 2018](https://arxiv.org/pdf/2007.14516v3.pdf)) | People read point estimates as more precise than they are. A range or a frequency format leads to better decisions. | "+44 fpts" should carry a band (+20 to +60). The matchup should read as a likelihood, not as two exact totals. |
| **NN/g, preattentive attributes** ([article](https://www.nngroup.com/articles/dashboards-preattentive/)) | Length and 2D position encode quantity best. Area and angle are hard to compare. | Use bars and aligned positions. No donuts or gauges for single numbers. |
| **BLUF / inverted pyramid** | Put the conclusion first and the support after it. | Every card and page opens with what to do and what it's worth. |

---

## What comparable products do well (Mobbin)

**The swap as one object.**
- [Premier League Fantasy, Transfers](https://mobbin.com/screens/fcf27033-bc52-49f1-aa29-c46f750ec744?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp) shows "Transfer out ↔ Transfer in" as a pair with the cost below it.
- [F1 Fantasy, Team Changes](https://mobbin.com/screens/8e3901fe-90bf-4884-b606-e1ee6fab6807?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp) says "You're about to make 2 changes" and shows each as *out → in* cards with the price delta on each side.
- The add/drop pair is the unit of decision, so it should be the unit of design.

**A score backed by its contributors.**
- [Oura, Readiness](https://mobbin.com/screens/3f85ee85-4724-4501-967f-460f6875e112?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp) runs score → one-line verdict → a *Contributors* list, where each contributor has a bar and a status ("Optimal", "Pay attention").
- [Visible, Morning Stability](https://mobbin.com/screens/21e71f6b-c03e-46f7-ab80-01c217ffa35d?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp) writes each contributor as a sentence ("Your HRV is stable, and is within its normal range") with a small range chart, today's value marked against the normal band.
- [Ultrahuman](https://mobbin.com/screens/b9a11036-827a-4e10-84ba-442f51045344?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp) does the same, with a written interpretation under the score.
- These are the closest analogue to "why this pickup": one number, then the ranked reasons behind it, each with its own tiny visual.

**A conclusion sentence above the chart.**
- [The Weather Channel, activity forecast](https://mobbin.com/screens/a42924d4-4f0c-48e1-9dd7-787e7b11899d?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp) opens with "Right now conditions are poor. The best time to play tennis tomorrow will be late morning", and the chart below backs that sentence up. Write the takeaway first and let the chart support it.

**Current → target, with a range.**
- [N26](https://mobbin.com/screens/8199c418-1c2f-47cc-a2ba-6aa2fce91aa4?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp), [Lightyear](https://mobbin.com/screens/5a2d0f1f-64bf-4c25-b103-c74fccbad4b3?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp) and [Vivid](https://mobbin.com/screens/7ac9c3e8-ad13-47d3-b0b8-a2f304b48a02?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp) all put *current* and *target* on one track, with the low–high range shaded, and give the source ("based on 58 analysts").
- [Revolut](https://mobbin.com/screens/301e5704-1cb1-428a-b08d-0914c60689bd?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp) shows the consensus as three short bars.
- This is how to show "my projection vs. the opponent's" and "the gain from this swap" without false precision.

**Recommendations ranked, with impact as a column.**
- [HubSpot, SEO recommendations](https://mobbin.com/screens/bc1ba2a3-126e-4a46-974f-bdde0ee48ec5?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp) lists each recommendation with *Impact* and *Difficulty* chips and a "View more information" link: verdict, two qualifiers, detail on demand.
- [Rox](https://mobbin.com/screens/3f692f59-31ca-4254-8d47-1112661613a1?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp) separates the evidence paragraph from the "Recommended action" and hides the reasoning behind a collapsed toggle.

**Honest AI framing.**
- [Uber Eats, Cart Assistant](https://mobbin.com/screens/14eb7e1d-147f-47a5-a43e-5c0d34d265ad?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp) ends the list with "AI can make mistakes. Please review the items… before adding to cart." It's short and placed where the user acts.
- That fits a recommend-only tool, where Kevin makes the final move on ESPN.

**Deadlines as context.**
- F1's "Team Lock Deadline 00D:12H:00M" bar and Premier League's "Gameweek 21 Deadline: 13 Jan 19:00" sit at the top of the action screen. Here, lineups lock at each tip-off, so lock time belongs on the row as well as in the header.

**Dense tables that still scan.**
- [PlanetScale Insights](https://mobbin.com/screens/ef455d28-04ea-46f4-a289-cb6c283ea929?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp) and [Uniswap](https://mobbin.com/screens/e39f0d0f-bed1-49ff-92e0-c53d36d34de6?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp) use inline sparklines, right-aligned tabular numbers and signed deltas.
- [Premier League, Fixture Difficulty](https://mobbin.com/screens/bc4bec57-ec17-4e03-917e-95ec016017eb?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp) is a team × week heatmap with a 1–5 key, which suits a "games left this week" grid.

**Side-by-side diffs.**
- [Semrush, Review your content](https://mobbin.com/screens/ed82aafc-c4dc-442d-87fc-359f7347f940?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp) and [Codecademy](https://mobbin.com/screens/3db54285-08df-44c3-a226-cf3e168b5e85?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp) highlight only what changed between two versions. Use the same idea for "current lineup vs. recommended": unchanged rows recede, changed rows stand out.

**What to avoid.** Most fantasy apps (Premier League, F1, NFL) are about branding: team colours, jersey art, gradients. That hurts here. Reviewers are Palantir product designers, and the clarity of the reasoning is the point.

---

## The top patterns to use

1. **Frame everything against one goal: winning this week's matchup.**
   - The Today page opens with a single sentence: "Projected to lose by 45 (1,158 vs 1,203). The top pickup closes about 44 of that."
   - Every recommendation shows its payoff in fpts, so each one is measured against the same gap.
   - Sources: BLUF; the Weather Channel pattern.

2. **Every recommendation has three tiers: verdict, reasons, evidence.**
   - **Verdict:** the action and its payoff ("Add Daniss Jenkins · drop Jabari Smith Jr. · +44 fpts this week").
   - **Reasons:** two or three ranked factors.
   - **Evidence:** a stat comparison, opened on demand.
   - Sources: Shneiderman; HubSpot; Oura.

3. **Reasons are ranked, quantified factors with a small visual each, not prose.**
   - For example: "Schedule: 2 games left vs 1 (+26)", "Form: 41.5 fpts/g over the last 15 days vs 35.4 season", "Role: minutes trending up".
   - Order them by contribution. The visual type follows the factor: game dots for schedule, a sparkline for form, a direction arrow for trend.
   - This is the direct answer to "the design should reflect the top reasons." It needs a data change (see below).
   - Sources: EUCA feature attribution; HAX "map inputs to outputs"; Oura and Visible contributors.

4. **Explain a swap by contrast: add vs. drop on the same measures.**
   - Show one card with both players on the same rows (fpts/g, games left, last 15 days), and highlight the rows where the added player wins.
   - This makes it obvious why it's *this* drop and not another, and why the engine refuses to drop someone who projects higher.
   - Sources: Miller's contrastive explanation; Premier League and F1 transfer screens.

5. **Show the gain as a range, not a point; show the matchup as a likelihood.**
   - Gains look like "+44 (+20 to +60)", drawn as a bar with a shaded band.
   - The matchup gets a current → projected track for each side. It can add a win probability once the engine has a variance estimate.
   - Sources: Kay and Hullman; N26 and Lightyear target tracks.

6. **Confidence is calibrated, secondary and actionable.**
   - Show it as a neutral three-step meter with its basis ("small sample", "day-to-day").
   - Low confidence changes the card: a quieter treatment and an instruction ("check injury news before tip-off").
   - Never colour confidence red or green; those colours belong to gain and loss.
   - Sources: PAIR trust calibration; Revolut consensus bars.

7. **Today is a checklist of moves to make on ESPN, in lock order.**
   - Use a numbered list, "3 changes to make on ESPN", sorted by tip-off, with the lock time on each row and locked rows visibly frozen.
   - When nothing is needed, say "You're set for tonight" as its own designed state.
   - The lineup view works like a diff: unchanged slots recede and changed slots stand out.
   - Sources: F1 "You're about to make 2 changes"; F1 and Premier League deadline bars; Semrush and Codecademy diffs.

8. **Tables are for comparison: dense, aligned, preattentive.**
   - Free agents and Opponent get tabular figures, right-aligned numbers, signed deltas and a sparkline for the last-15 trend.
   - Games left by day becomes a heatmap grid.
   - Colour is used only for status (injury) and direction (gain or loss).
   - Sources: NN/g preattentive attributes; PlanetScale; Uniswap; Premier League FDR.

---

## Visual hierarchy rules

**Type: at most four levels in any card.**

| Level | Use | Treatment |
|---|---|---|
| 1. Payoff | the number that decides it (+44 fpts, −45 behind) | Largest. Tabular figures, signed. |
| 2. Verdict | the action ("Add X · drop Y", "Start X at UT") | Semibold, body size or one step up. |
| 3. Reasons | ranked factors | Regular body, each with its micro-visual. |
| 4. Meta | confidence basis, timestamps, source | Small, muted. |

**Colour carries meaning, never decoration.**
- One accent colour, for the primary action and the current selection.
- Green and red only for signed deltas (gain and loss), always paired with a +/− sign so colour is never the only cue.
- Confidence is neutral (fill level), injuries are amber icon plus text, and locked rows are desaturated.

**Numbers.**
- Tabular figures, right-aligned in tables, one decimal at most, always with units (fpts, fpts/g, games).
- Deltas always carry a sign.
- Projections carry a range wherever there's room.

**Order.**
- Recommendations sort by payoff, with lock time breaking ties.
- Inside a card, reasons sort by contribution.
- Nothing is alphabetical unless it's a lookup list.

**Every recommendation shows four things:** action, payoff, top reasons, confidence. The data already guarantees this; the design must never drop one.

**Freshness is always visible.** "Updated 3:46 PM ET" sits in the header. Replay mode gets its own frame (different header colour and a "Snapshot from …" label) so it can't be mistaken for live data.

**Avoid:**
- reasons written as paragraphs
- donuts or gauges for single values
- team-colour or jersey branding
- AI sparkle iconography
- traffic-light confidence
- more than one primary button per view

---

## Engine output for these patterns (engine 1.1)

Added 2026-11-20 so that patterns 3 and 5 can be built. The details are in the build plan under Phase 2.

- `factors` on every lineup slot, change and pickup, ranked: drivers by |`impact_fpts`|, then supporting signals. Each one has a `label` to show, a `value` and a `compare` for a small comparison visual, and a `unit` (`games`, `fpts/g`, `mpg`, `%`). For a pickup, the drivers add up to the week gain. For Daniss Jenkins for Jabari Smith Jr., that's schedule +35.4 and per-game +8.7, which makes +44.1.
- `gain_this_week_range` on pickups, and `mine_range`, `opponent_range` and `win_probability` on the matchup projection. All ranges are 80% intervals. The first run gives a 26% chance to win, projected 1,158 vs 1,203.
