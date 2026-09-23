# My Virtual Planner — Product, Users, and End-to-End User Flows

> **Scope.** This document explains the product **in plain language**: its purpose, users, every complete user journey (from entry to outcome), the AI decision-making pipeline, entity relationships and business rules, connected services, and a per-feature status map. It complements `TECHNICAL_HANDOFF.md` (architecture/backend contracts) and `SECURITY_AUDIT.md` (auth/RLS gaps).
>
> **Grounding.** All claims are traced in the current working tree (`main`, commit `72465058`, source-identical to audited `fdb858a` except documentation). Legend: **[SV]** = read in source this session · **[INF]** = inferred from code · **[X]** = not traced / not accessible. No files, settings, data, or functions were modified or invoked to produce this document.

---

# Part 1 — Purpose, Users, and Complete User Journeys

## 1. Purpose and Users

**Purpose.** My Virtual Planner (repo `venue-iq`) is a white-label, per-venue AI concierge for wedding venues. Each venue embeds a chat widget on its own website; couples ("brides" in the code's voice) chat anonymously with an AI "virtual planner" that answers venue questions from a venue-curated knowledge base, checks real date availability, quotes pricing, books tours, and escalates to a human planner via SMS through GoHighLevel (HighLevel). Venue staff get a dashboard to train the bot, manage bookings, and review conversations. **[SV]**

**User types and what each can do** **[SV]**:

| Role | How identified | What they can do |
|---|---|---|
| **Anonymous couple** | No login; reaches `/?venue=<slug>` (or `?embed=1` iframe) | Chat with the planner, check date availability, ask pricing/policy questions, book a tour, request a human-planner handoff ("Text me" card), leave thumbs feedback. No account needed anywhere in the couple journey. |
| **venue_owner** | `User.role`, has `User.venue_id` (set via invite) | Everything on the staff dashboard for their one venue: onboarding/training wizard, knowledge review/approval, document & transcript ingestion, calendar (book/block weddings), conversations + CSV export, transcripts, feedback review, settings (Google Calendar sync, HighLevel connection, First Look videos), analytics. The header never shows a venue switcher — their own venue always wins (`VenueContext.jsx:58`). |
| **venue_staff** | `User.role`, has `venue_id` | Same dashboard pages as the owner for their venue; `Feedback.jsx:18` additionally restricts the feedback page to `admin`/`venue_owner` only. (Whether staff vs owner differ elsewhere is mostly untraced — see §8.) |
| **admin** (platform super-admin) | `User.role === 'admin'` | Everything for every venue, plus the `SuperAdmin` page: create venues, edit venue records, invite users (owner/staff), see all users. Switches the managed venue via the header selector; the choice persists in `localStorage` (`viq_selected_venue`) and the `?venue_id=` URL param. |

**How they interact (the contract between the three):** the couple never sees staff tools; staff never see another venue's data *by design* (a single `venue_id` key on every record); the admin provisions venues and staff. A couple's handoff or tour request surfaces to the planner *outside* this app, in HighLevel (SMS thread + contact note with a transcript link back into the app at `ChatTranscript?id=…`). **[SV]**

**Staff ↔ couple touchpoints inside the app:** Conversations list, transcript viewer, feedback records, and `ContactSubmission`/`HandoffRequest` data on the dashboard. **[SV]**

---

## 2. Complete User Journeys

### 2.1 How a couple reaches the correct venue's planner

**Route:** `/` (page `Home.jsx`). **Query parameters, exact names** **[SV]** (`src/pages/Home.jsx:37-45, 80-82`):

- `?venue=<slug>` — **required**; matches `Venue.slug`. There is deliberately *no* fallback venue: a bare URL with no slug and no user renders the marketing `LandingPage` (no venue queries run at all).
- `?embed=1` — treated as embedded also when `window.self !== window.top` (real iframe). Embedding changes three behaviors: (a) slug is *always* required (`missingSlug` screen: "No venue specified" + Sign-in link); (b) a logged-in owner viewing the embed is **never** redirected to the dashboard (`Home.jsx:118`); (c) scroll/focus discipline (input never autofocuses on load; all focus calls use `preventScroll:true` so the iframe never yanks the host page).
- `?message=<text>` — pre-loads and auto-sends one opening message once the venue resolves (`Home.jsx:271-280`), e.g. a CTA button on the venue's site linking "Do you have October 2027 open?" straight into a question.
- `?debug=1` — shows the `DebugTraceButton` (dumps the per-turn internal decision trace). **[SV]**

**Branches when no/mismatched venue** **[SV]** (`Home.jsx:96-105, 316-341`): no slug + not embedded + not admin → LandingPage; no slug + admin (non-embedded) → `VenuePickerScreen` (admin convenience); no slug in embed → "No venue specified"; slug that matches nothing → "We couldn't load this venue's planner."

**Frontend logic after resolution** **[SV]** (`Home.jsx:161-200`): React Query loads `Venue.get(id)`, `BookedWeddingDate.list()`, `VenueKnowledge.filter({venue_id, is_active:true})` (scoped per venue; this is what makes dashboard approvals reach the live chat), and the venue's `FirstLookConfiguration`. Then `useChatFlow(...)` initializes the chat brain.

**Data persistence & returning visitors** **[SV]** (`Home.jsx:206-267`):

- Transcript + lead name/email/phone are saved to `localStorage` under `viq_chat_v1_<slug|id>` on every message change; **TTL 24 hours** (`CHAT_TTL_MS`), then discarded. On reopen within 24h, messages are restored, lead fields restored, and the opening greeting suppressed (`setShowGreeting(false)`). `activeFlow` is deliberately NOT persisted (a half-finished flow would restore broken).
- Server-side: a `ChatSession` row is created **lazily on first interaction** (`ensureChatSession`, `useChatFlow.jsx:82-106`), then the transcript/lead fields are synced debounced (2 s) on every message change (`scheduleSessionSync`).

### 2.2 Venue creation, staff invitations, onboarding (admin/owner setup journey)

**Venue creation** **[SV]** (`SuperAdmin.jsx:355-417`): "Add Venue" form (name*, slug*, location, planner_name*, timezone from a 7-option US list, phone, email, website, description) → `Venue.create` directly through the entity SDK. The UI warns that the chatbot link won't work without a slug. There is no venue deletion or activation UI **[SV]**.

**Staff invitations** **[SV]** (`SuperAdmin.jsx:53-108, 230-349`):

1. Admin opens "Invite User" dialog → email*, name, venue*, role (`venue_owner` | `venue_staff`).
2. → backend `createUserInvite` (service role): expires that email's other pending invites, blocks the invite if the email is already a registered user, creates a `UserInvite` (UUID token, 7-day expiry), and **emails the invite itself** via `Core.SendEmail` with a link on the hardcoded production host (`https://myvirtualplanner.app`).
3. UI rebuilds the link as `https://myvirtualplanner.app/invite?token=…` (deliberately ignoring the backend URL, which under the editor carries a sandbox host), and shows **email delivery status** (sent vs. failed with the specific error, plus copy-link fallback).
4. Recipient opens `/invite?token=…` → `validateUserInvite` (checks pending/accepted/expired) → `Register.jsx` completes email/password + OTP signup → `acceptUserInvite` creates/links the user and sets their `venue_id` and role (service role) → `window.location.href` to Dashboard so the auth context re-reads. **[SV]** `Invite.jsx`, `Register.jsx` (flow from project decisions; exact page internals not re-traced this session — **[X]**).
5. Legacy path also present: `AssignUserForm` uses `base44.users.inviteUser` and then tells the admin to *manually* set `venue_id` — a documented dead end superseded by the token flow. **[SV]**

**Onboarding ("Train Your AI Concierge")** — entry: Dashboard's `OnboardingReadiness` card → `VenueOnboardingWizard` (opens on the specific topic whose readiness row was clicked). **[SV]** (`Dashboard.jsx:139-166`). Feeding the bot happens through four ingestion paths, all of which write **drafts only** (`needs_review: true`, inactive) that a human must approve on the Planner page before they go live:

| Path | UI | Backend | What it produces |
|---|---|---|---|
| Questionnaire | `VenueOnboardingWizard` (topics from `onboardingQuestions.jsx`: required + bonus topics) | `processOnboardingAnswers` (LLM) | Draft Q&A per topic; updates `VenueOnboardingProgress.topic_status` (non-destructive — existing knowledge preserved) **[SV]** backend |
| Auto-generate | `VenueSettings` (source: venue basics / packages / pricing) | `generateAutoKnowledge` | Draft FAQ/pricing entries from existing structured data; skips questions that already exist |
| Documents | `Planner` → "Upload Documents" (`VenueDocumentUpload`) | `processVenueDocument` (PDF → `Core.InvokeLLM`, batched by pages) | Draft facts with `source_excerpt` + `source_page` for verification; rejects unverifiable/oversized input (422) |
| Transcripts | `Planner` → "Upload Transcripts" (`TranscriptUpload`) | `processTranscriptIntelligence` (6 passes: pricing, capacity, policies, amenities, brand_voice, handoff) | Draft Q&A extracted from real planner-call transcripts; duplicate-question detection |

**Review & activation** **[SV]** (`Planner.jsx:92-360`, "Review & Train" tab): lists ALL knowledge for the venue (drafts included, by design), filters by review state and category; "Approve & Activate" sets `needs_review:false, is_active:true` (single or "Approve All Visible" with a confirm dialog); Reject deletes; manual Add/Edit Q&A with category + topic selectors. Approving invalidates the `knowledge-active` query key, which is the same key the chatbot reads — **that is the mechanism by which training reaches the live bot.** A "Test Chatbot" tab (`PlannerTestChat`) lets staff try it.

**Other venue configuration** (readiness for visitors) **[SV]** — imports/structure of `VenueSettings.jsx`: Google Calendar sync (`GoogleCalendarSync` → `syncGoogleCalendar`, APP_USER connector — each venue staff connects their own Google account; the chosen calendar id is saved on the venue), HighLevel connection check (`HighLevelConnection` → `checkHighLevelConnection`, which verifies the tour calendar actually belongs to the venue's HighLevel account and is active), and (per `VenueSettings` imports, untraced detail **[X]**) First Look video settings and pricing/packages managers.

### 2.3 Chat: the core conversation journey

**Entry points** **[SV]**: the text input (`ChatInput.jsx`); the header **"Book a tour"** button; the footer **"Talk to a planner"** link; tour-prompt quick replies ("Schedule a tour" / "Maybe later") shown after budget/tour completions.

**Suggested questions — important product finding:** `QuickActions.jsx` (chips: Calculate Budget / View Packages / Check Your Date / Schedule a Tour) and the whole `handleQuickAction` switch **exist but are not rendered anywhere** — `Home.jsx` does not import `QuickActions` and never calls `chat.handleQuickAction` **[SV, grep-verified]**. So the only visible affordances today are the two buttons above; "suggested questions" are effectively retired UI. Consequence: the flow components for **budget, availability calendar, packages, gallery, and visualizer are currently unreachable** (nothing sets those `activeFlow` values except dead code) — details in Part 2 §6. The only reachable flow is **tour** (header button, `tour_interest` intent, or post-completion prompts).

**Per-message pipeline** **[SV]** (`useChatFlow.jsx:handleUserMessage`, fully traced this session):

1. Instantly render her message + typing indicator (no await first).
2. `ensureChatSession()` (creates the ChatSession lazily).
3. Load-race guard: if venue/knowledge props aren't resolved yet, fetch them directly (so a `?message=` auto-fire on load still classifies correctly).
4. **Direct planner request** (`handoffIntent.js` regex — "talk to Saydee / a human / your planner", planner-name aware): skips the LLM entirely and opens the contact card immediately.
5. **Classifier LLM** (`buildClassifierPrompt` → `Core.InvokeLLM`, model `gemini_3_flash`, strict JSON schema): intent (general / date_inquiry / tour_interest / package_inquiry / visual_request), topic (19-value vocabulary), date extraction (stated-year preservation, `year_missing`, weekday capture), guest count, handoff acceptance.
6. **Handoff acceptance branch**: if a pending offer exists and she says yes → inline `HandoffContactCard`; any other message clears the offer and flows on normally (no interception).
7. **Deterministic date logic** (code, not LLM): ambiguity guards (bare day-of-month with no month → clarifying question; missing year → "what year?"; stated weekday conflicts with the real calendar → offers the corrected date), past-date heads-up, multi-date list checks, month/multi-month open-dates listing (paginated 5 at a time on repeat), single-date availability via `checkDateAvailability` with nearest alternatives, and a compact "rapid check" mode when she's checking dates back-to-back. Full trace in §3.
8. **Knowledge assembly**: topic-tagged `VenueKnowledge` rows (primary block) + a general baseline; if a topic has no rows, falls back to *all* knowledge.
9. **Generator LLM**: `invokeAnthropicGenerator` (direct Anthropic API, forced tool-call JSON: `{needsHandoff, topicSummary, answer}`).
10. **Reply composition**: for date verdicts, code always prepends the deterministic verdict sentence and the model only supplies the follow-up (`composeAvailabilityReply` strips any duplicate verdict the model echoes).
11. **Handoff staging**: `needsHandoff:true` → either the card directly (if the reply committed to contact) or a pending offer; a safety-net regex also catches offers the model wrote without setting the flag.
12. **Failure behavior**: any uncaught error → "Sorry — something went wrong on my end just now. Could you send that again?" and the turn is logged to the debug trace; availability-check failure → the bot never claims open/booked, says it wants to double-check and offers planner confirmation.

**Conversation memory** **[SV]**: three layers — (a) per-session refs (current topic, pending action `awaiting_quote_details`, guest count, year, weekday(s), month(s), her focus date, last multi-date majority month, already-checked dates set, month-list pager); (b) `localStorage` transcript + lead fields (24 h, per venue); (c) the server `ChatSession` (messages, lead fields, `flows_completed`, `flow_results`, handoff flags) which is what staff later read.

**Session recovery**: on reload the transcript restores from `localStorage`; the server session is created fresh per page load on the next interaction, so localStorage is client-side continuity while server records restart per page load **[INF; see §8]**.

### 2.4 Availability, pricing, packages, budget

- **Availability via chat** **[SV]**: every date question funnels to `checkDateAvailability` (`base44/functions/checkDateAvailability/entry.ts`, read in full): source of truth = `BookedWeddingDate` (with `end_date` ranges; `merged_into_id` archives excluded) ∪ `BlockedDate` for that venue; alternatives = same-weekday within ±6 weeks, then nearest days within ±120 days; a `monthOpenings` mode enumerates open days by weekday filter. A month-openings check *always* runs when month+year are known, so date questions never fall through to the model with no verdict.
- **Availability calendar flow** (`AvailabilityChecker`): date picker → check → available ("Great News!" + Schedule a Tour) or booked (clickable alternative dates to re-check); cancel returns to chat. **Currently unreachable** (dead quick-action wiring) **[SV]**.
- **Pricing**: the chatbot's pricing answers come from `VenueKnowledge` topic `packages_pricing` — `VenuePackage` is *deliberately excluded* from the generator context (drift history; comment in `useChatFlow.jsx` around the topic-assembly block) and remains the source for the in-chat package cards and the dashboard. The **budget calculator** (`EnhancedBudgetCalculator`, 1,047 lines: guest tiers, day/season availability rules, per-category option pricing from `WeddingPricingConfiguration`) is **deliberately disabled** — the quick action that opened it is commented out "pending rebuild (vendor pricing changed)" **[SV]**. Its old completion path wrote a `SavedBudgetEstimate` and used `SendBudgetForm` → `sendBudgetQuote` (HighLevel contact + email/SMS delivery of the estimate) — all code intact but dormant.
- **Saved/shared results**: budget estimates were saved to `SavedBudgetEstimate` and delivered by SMS/email (`sendBudgetQuote`); tour requests to `ContactSubmission`; handoffs to `HandoffRequest` + HighLevel. (Budget path dormant as above.)

### 2.5 Tour booking, enquiries, contact capture, human handoff

**Tour booking** **[SV]** (`TourScheduler.jsx` + `flowCompletionHandlers.jsx:handleTourComplete`):

1. `getHighLevelAvailability` (venue-routed credentials) for the next 30 days → day list → time list → details (name/email/phone/wedding date/guest count; prefilled from chat state when she already shared them; wedding date prefilled from an availability check).
2. On confirm: `ContactSubmission.create` (source `tour_scheduler`) → `createHighLevelAppointment` (upserts a HighLevel contact, books into the venue's tour calendar).
3. **Honest failure handling**: if the HighLevel appointment fails, the app does *not* tell her it's booked — the `ContactSubmission.notes` record the error for staff, and the bot says "someone will reach out shortly to confirm." Success → confirmation screen + bot message + `flows_completed` update.
4. Cancellation at any step; slot-load failure → "Tour availability is temporarily unavailable. Please contact the planner."

**Human handoff ("Text me")** **[SV]** (`HandoffContactCard.jsx` + `createHighLevelLeadAndNotify`, read in full): triggers are (a) her explicit "talk to a planner" phrasing, (b) the generator setting `needsHandoff` (contracts/refunds/sensitive/no-knowledge cases), or (c) the safety-net offer regex. She accepts → inline card (name*, phone* 10+ digits, email optional) → `createHighLevelLeadAndNotify`: upserts the HighLevel contact (with wedding date/guest count/question custom fields for Sugar Lake only), adds tags (`virtual planner lead`, `Planner_Contact_Requested`, `topic_*`), attaches a planner note containing a **transcript link** (`https://myvirtualplanner.app/ChatTranscript?id=…`, hardcoded production host) plus everything she shared, sends her an intro SMS from the planner's number, updates the `ChatSession` (status `handed_off`, lead fields), and writes a `HandoffRequest` audit row. Failures: contact upsert failure → 500 → card shows a retryable error; SMS failure → request still saved (`intro_failed` + error message) and the card shows the amber "Your request was saved… we couldn't send the introduction text" state. The planner then continues the conversation in HighLevel SMS; staff can open the transcript link (login-gated, venue-checked by `getChatSessionPublic`).

**Message feedback** **[SV]** (`MessageFeedback` under every bot bubble): thumbs up/down + optional comment → `ChatFeedback` record bundling the flagged message, her preceding message, full transcript, and the debug trace; a thumbs-down also fires `createClickUpTask` (ClickUp debug task; failures are soft and never break feedback).

### 2.6 Venue visualization and photo selection

- **VenueVisualizer** (AI "envision your wedding" on a real photo base): `generateVenueVisualization` (Stability AI; masked inpainting when the `VenueVisualizationPhoto` has a mask, else image-to-image; the prompt is assembled from `VisualizerHeroImage` option rows — vibe/density/colors/season). On completion it offers the tour flow. **Currently unreachable in the chat UI** (dead quick-action wiring) **[SV]**; the "visual_request" chat intent instead makes the generator describe spaces from knowledge and offer a tour (the generator prompt explicitly says "No photo gallery exists yet" for that intent) — an intentional-looking stopgap.
- **VenueGallery**: photo grid from `VenuePhoto` per venue; per-photo "Schedule a Tour". **Also currently unreachable** **[SV]**.
- **First Look** **[SV]** (`FirstLook.jsx` + `firstlook/` components): a floating phone-shaped widget playing venue-configured **Wistia** videos (muted looping welcome video from the host, unmute hint, selectable mini-tours with custom progress bar). Config comes from `FirstLookConfiguration` (host name, titles, video ids, options). This is a client-side embed of Wistia — not a server integration.

### 2.7 Staff dashboards, feedback, analytics, admin tools

- **Dashboard** **[SV]** (`Dashboard.jsx`): onboarding readiness card, quick stats (next-30-day weddings, this year, this month), date-range filter, calendar connection health, chat-session analytics, venue analytics, industry benchmarks (`getBenchmarkingData`), lead-source breakdown, quick-action tiles (Calendar, Weddings List, Settings, Chatbot Preview, Feedback for owner/admin), upcoming weddings list. Admin without a venue gets the `VenueSelector`; unassigned staff get "No Venue Assigned."
- **Conversations** **[SV]** (`AdminChatSessions.jsx`): venue-scoped list (up to 1,000), search across name/email/phone/topic/first message, category tabs (All/Handoffs/Booked tours/Conversations), pagination (50/page), CSV export (selected or all) built client-side. Each row links to…
- **Transcript viewer** **[SV]** (`ChatTranscript.jsx`): loads via `getChatSessionPublic` (auth + venue check server-side), shows lead info, "what she shared" (date/guests/budget/topic), flows used, the full transcript, copy-as-text, and prev/next sibling navigation within the venue's sessions.
- **Feedback** **[SV]** (`Feedback.jsx`): role-gated (admin/venue_owner), thumbs-down-first filter, expandable transcript + raw debug trace per record.
- **Calendar** **[SV]** (`AdminCalendar.jsx`): month `CalendarView` of bookings + blocked dates; click a date → book a wedding (`WeddingForm`) or block it (`BlockDateForm`); click an existing booking → edit; "Clear All Synced Dates" (confirm dialog) → `clearSyncedDates`.
- **SuperAdmin** (§2.2), **Planner** (§2.2 review path), **AdminWeddings** list page (not traced this session **[X]**).

### 2.8 Other implemented journeys not in the standard list

- **`?message=` deep-link journey** (venue site CTA → pre-answered question) — §2.1. **[SV]**
- **Auth/invite acceptance journey** (token → register w/ OTP → dashboard) — §2.2. **[SV]**
- **Feedback-to-ClickUp debugging journey** (thumbs-down → internal task) — §2.5. **[SV]**
- **Google Calendar sync journey** (staff authorizes own Google account → list calendars → pick wedding calendar → 3-year event window synced into `BookedWeddingDate`, multi-day events handled, re-syncs deduped by `google_event_id`, each attempt audited in `CalendarSyncEvent`). **[SV]** backend read in audit; component not re-traced this session.
- **Debug-trace journey** (`?debug=1` → download per-turn classifier/retrieval/generator trace). **[SV]**

---

# Part 2 — AI Internals, Data Rules, Integrations, Feature Map, Examples, Unknowns

## 3. How the AI decides (flows vs deterministic code vs knowledge vs generation)

The chatbot is a **four-layer decision system**. Almost everything the bride experiences as "the AI" is deterministic code; the two LLM calls are narrow and heavily constrained.

### 3.1 The two LLM calls and where their prompts live

| Step | Prompt location | Engine & model | Output contract |
|---|---|---|---|
| **Classifier** (every message) | `src/components/hooks/buildClassifierPrompt.jsx` (prompt template + `CLASSIFIER_SCHEMA`) | `base44.integrations.Core.InvokeLLM`, model `gemini_3_flash` **[SV]** | Strict JSON: `intent` (5 values), `topic` (19-value vocabulary), `wedding_date`/`wedding_dates` (ISO), `year_missing`, `month`/`day`/`year`, `stated_weekday(s)`, `guest_count`, `handoff_response` (accepted/declined/unrelated). |
| **Generator** (knowledge answers) | `src/components/hooks/buildGeneratorPrompt.jsx` (full persona/system prompt) | backend `invokeAnthropicGenerator` → direct Anthropic REST (`ANTHROPIC_API_KEY`), model `claude-sonnet-5`, **forced tool** `reply` via `tool_choice: {type:'tool', name:'reply'}` **[SV]** | `{answer, needsHandoff, topicSummary}`. A missing tool_use block is treated as a parse failure and logged. |

Ingestion-time LLM calls (all review-gated, none go live without human approval): `processOnboardingAnswers` (questionnaire → Q&A drafts), `processVenueDocument` (PDF pages → facts, via `Core.InvokeLLM` with page batches; exact model untraced **[X]**), `processTranscriptIntelligence` (6 analysis passes), `generateAutoKnowledge` (venue basics/packages/pricing → drafts).

### 3.2 Decision flow for one chat message

`useChatFlow.handleUserMessage` **[SV]**, in order, with which layer decides:

1. **Regex first, no LLM** (`handoffIntent.js`): an explicit "talk to a planner" phrase opens the contact card immediately and returns.
2. **Classifier decides** the intent, topic, dates, and (only if a handoff offer is pending) acceptance.
3. **Deterministic date engine** overrides the LLM wherever they disagree: the classifier's dates are authoritative over the regex parsers, but guards then verify — a year she never stated is discarded (year-guess guard); a bare day with no month triggers a clarifying question; a missing year triggers "what year?"; a stated weekday that conflicts with the real calendar triggers a one-question correction offering the nearest matching date.
4. **Code-only reply modes** (no generator call at all): multi-date verdicts ("Oct 3: open · Oct 10: already booked"), month/multi-month open-date lists (paginated, repeat-aware), rapid back-to-back date checks (compact replies), and all clarity questions.
5. **Availability check** (`checkDateAvailability`) runs for single-date inquiries; code composes the verdict sentence ("Good news — Saturday, October 23, 2027 is open!" / "…already booked. The closest open dates are…").
6. **Knowledge assembly**: exact filter `venue_id` + `is_active:true`; primary block = rows tagged with the classifier's `topic`, plus a `general` baseline. If the topic has zero rows, the fallback sends ALL knowledge. `VenuePackage` is deliberately not in the generator context (packages/pricing facts come only from `VenueKnowledge`).
7. **Generator produces only the follow-up** for date verdicts (`composeAvailabilityReply` removes any verdict sentence the model repeats), or the whole answer otherwise.
8. **Handoff staging**: `needsHandoff:true` → card or pending offer; plus a safety-net regex that stages an offer if the model wrote one without the flag ("reach out / text you / I'll have…").
9. **Flow triggers**: `intent === 'tour_interest'` → short warm reply, then the TourScheduler opens automatically; `visual_request` → describes spaces from knowledge (gallery/visualizer flows are currently unreachable — §6).

### 3.3 Context assembly — what each prompt receives

- **Classifier**: today's date, venue timezone, the **last 6 messages** verbatim, and a "conversation state" block (current topic, pending action, known guest count/year/date, handoff-pending instructions). Continuity rules in the prompt make a bare "yes, 120 guests" after a price request classify as `package_inquiry` (she's completing the quote), not a new inquiry.
- **Generator**: venue name, planner name/title, the availability verdict (if any), intent, month-season context, the topic knowledge block, a "KNOWN ABOUT THIS BRIDE" block (guest count, date, year, and whether the bot owes her a price), recent history, and her current message.

### 3.4 Non-negotiable system rules baked into the generator prompt **[SV]**

- Never claim a date is open/booked except from the provided `AVAILABILITY CHECK RESULT`.
- Never promise a lookup ("let me check") — the check either already ran or it didn't; ask for the date instead.
- An offer to have the planner reach out must be the ONLY question and the last sentence, and must set `needsHandoff:true`.
- Pricing is open: ranges lead with the floor; never withhold prices to collect contact details; proactively quote the cheapest package that genuinely fits her guest count.
- Capacity math: standard max vs hard ceiling vs off-season cap; 10–15% no-show reasoning; over-ceiling counts escalate to the planner instead of fake pricing.
- Never invent facts (incl. location/weather "warm color"), never extend inclusion lists, never claim gratuity is included, always name the separate bar/alcohol cost when relevant.
- Handoff only for: nothing relevant in knowledge, contracts/refunds/payment disputes, emotionally sensitive situations, or an explicit ask — a partial answer + confirm-offer always beats a pure handoff.

### 3.5 Fallbacks and failure behavior

| Failure | What the bride sees |
|---|---|
| Classifier or pipeline throws | "Sorry — something went wrong on my end just now. Could you send that again?" |
| Generator returns no usable answer | Generic "could you tell me a little more…" reply (parse failure logged) |
| Availability check fails | Never claims open/booked — "I want to double-check that date — let me have {planner} confirm it!" |
| Venue knowledge empty for topic | Fallback to all knowledge rows |
| HighLevel appointment fails on tour | "Someone will reach out shortly to confirm" (request saved, error recorded on the submission) |
| HighLevel SMS fails on handoff | Amber "Your request was saved… we couldn't send the introduction text" |

**Observability**: every turn pushes a debug-trace entry (classifier output, retrieval topic + matched entries, date resolution, generator prompt/output, final reply). It surfaces via `?debug=1`, and is bundled into `ChatFeedback` records — so a thumbs-down is fully diagnosable from one record.

### 3.6 What the LLM never sees / never controls

Booked-date data reaches the bride only through `checkDateAvailability`'s boolean verdict (no couple PII ever enters a prompt). HighLevel credentials, invite tokens, and pricing configuration are server-side only. The LLM cannot create records — the only writes are deterministic code paths (ChatSession sync, ContactSubmission, HandoffRequest).

---

## 4. Data relationships and business rules

### 4.1 Entity relationship map (tenant key: `venue_id` everywhere)

```
Venue (1)───(*) VenueKnowledge          Venue (1)───(*) VenuePackage
        ├───(*) VenueOperatingRules            ├───(*) WeddingPricingConfiguration
        ├───(*) VenueOnboardingProgress        ├───(*) FirstLookConfiguration
        ├───(*) VenuePhoto                     ├───(*) VenueVisualizationPhoto
        ├───(*) VisualizerHeroImage (global, no venue_id)
        ├───(*) BlockedDate                    ├───(*) BookedWeddingDate
        ├───(*) ContactSubmission              ├───(*) ChatSession
        ├───(*) CalendarSyncEvent              └───(*) HandoffRequest

ChatSession (1)───(*) messages[]            ChatSession (1)───(0..1) HandoffRequest
ChatSession (1)───(*) ChatFeedback (chat_session_id)
UserInvite ──creates──> User (venue_id, role: venue_owner | venue_staff)
```

### 4.2 Sources of truth and precedence rules **[SV]**

| Fact | Source of truth | Precedence / notes |
|---|---|---|
| Is a date open? | `BookedWeddingDate` (with `end_date` ranges; `merged_into_id` archives excluded) ∪ `BlockedDate`, evaluated **only** in `checkDateAvailability` | Client-side `bookedDates` data is display-only; every chat answer re-checks via the function. A failed check = "unverified", never a guess. |
| Chat pricing answers | `VenueKnowledge` rows tagged `topic: packages_pricing` (active, approved) | `VenuePackage` is deliberately excluded from the generator to prevent drift; it powers package cards + dashboard only. |
| Budget-calculator pricing | `WeddingPricingConfiguration.pricing_data` | Separate structured grid; calculator currently disabled. |
| "Is the tour actually booked?" | HighLevel appointment API result | Failure → request saved, bride told someone will confirm. HighLevel is the planner's operational calendar. |
| Who is the lead? | HighLevel contact (upserted by phone) is the planner's working record; `ChatSession`/`ContactSubmission`/`HandoffRequest` mirror it for staff UIs | Chat lead fields sync into the session; handoff writes the bride's name/phone/email back onto the session. |
| What the bot knows | `VenueKnowledge` with `is_active:true` AND not `needs_review` | The review gate is the product's core safety rule: **no AI-extracted content answers a bride without human approval.** |

### 4.3 Field-level logic that shapes behavior

- `Venue.slug` — required for any embed; missing slug = "No venue specified" screen.
- `Venue.planner_name` / `planner_title` / `head_planner_name` — drive handoff copy and the direct-request regex; no default person name on purpose.
- `Venue.timezone` — used by classifier context, tour availability fetch, and calendar sync.
- `Venue.google_calendar_id` + `availability_data_verified` — set by calendar sync; when verification is false, availability answers must not be given.
- `BookedWeddingDate.google_event_id` — dedupes re-syncs; `clearSyncedDates` deletes ALL synced dates (manual bookings are not distinguished — see §8 caveat).
- `ChatSession.handoff_offered / handoff_accepted / handoff_triggered / handoff_topic` + `flows_completed` / `flow_results` — power the admin list filters ("Handoffs", "Booked tours") and the transcript viewer.
- `UserInvite.token` + 7-day `expires_at` — one pending invite per email+venue; expired/accepted states enforced server-side.
- localStorage keys: `viq_chat_v1_<slug|id>` (transcript, 24h TTL), `viq_selected_venue` (admin's managed venue).

### 4.4 Sync and processing boundaries

- Chat transcript → ChatSession: debounced 2 s after message changes.
- Onboarding ingestion: non-destructive (draft insertion; existing curated knowledge is never deleted).
- Calendar sync: 3-year event window, paginated; each attempt audited in `CalendarSyncEvent`; multi-day events stored as ranges.
- localStorage persistence: client-side only, per venue, 24 h.

---

## 5. Connected services and integration points

| Service | Mechanism | Used by | Scope | Failure behavior |
|---|---|---|---|---|
| **Anthropic Claude** (`claude-sonnet-5`) | Direct REST from backend function; secret `ANTHROPIC_API_KEY` | `invokeAnthropicGenerator` (chat replies only) | Global | Parse failure → generic fallback reply, logged |
| **Base44 LLM integration** (`gemini_3_flash`) | `Core.InvokeLLM` from frontend/backend | Chat classifier; document/transcript/onboarding extraction | Global (integration credits) | Same as pipeline failure |
| **GoHighLevel (HighLevel)** | Direct REST (`services.leadconnectorhq.com`, API v2021-07-28); per-venue credentials via `highLevelConfig(venueId)` — secret prefix map (e.g. venue `6aac0d32…` → `CONRAD_*`), default `HIGHLEVEL_*` **[SV]** | `createHighLevelLeadAndNotify` (contact upsert, tags, note, intro SMS), `createHighLevelAppointment`, `getHighLevelAvailability`, `createHighLevelContact`, `sendBudgetQuote`, `checkHighLevelConnection`, `getHighLevelWeddingDates` | **Per venue** (with global fallback) | 503 "Planner texting is not connected…" for missing config; SMS failure → `intro_failed` HandoffRequest + amber card state |
| **Google Calendar** | APP_USER connector via workspace-registered OAuth app ("Google Cloud Console for Calendar", id `6a2b72d0b1ae3cefb36ece05`); each venue staff authorizes their own Google account | `syncGoogleCalendar` (list calendars, 3-year event sync), audited via `CalendarSyncEvent` | **Per venue (per user's Google account)** | `not_connected` status surfaces in Calendar Connection Health |
| **Stability AI** | Direct REST; secret `STABILITY_API_KEY` | `generateVenueVisualization` (inpainting / image-to-image) | Global | 500 JSON error to caller; flow unreachable currently |
| **ClickUp** | Direct REST; secrets `CLICKUP_API_TOKEN`, `CLICKUP_FEEDBACK_LIST_ID` | `createClickUpTask` on chat thumbs-down | Global | Fire-and-forget; never breaks feedback |
| **Wistia** | Client-side embed (no server secret) | First Look video widget (`FirstLookConfiguration`) | Per venue config | Falls back to thumbnail image, then gradient |
| **Base44 email** | `Core.SendEmail` | Invitation emails (`createUserInvite`) | Global | Delivery status surfaced in SuperAdmin with copy-link fallback |
| **Base44 storage/files** | `Core` upload endpoints | Venue photos, uploaded documents/transcripts | Global | — |

**Config layering:** Base44 platform (auth, entities, functions, secrets, hosting) → workspace secrets (API keys above) → per-venue overrides (HighLevel prefix map, `Venue` fields: slug, timezone, planner names, google_calendar_id, domain) → per-user connections (each venue's own Google account via APP_USER connector).

---

## 6. Feature map — status of each feature

Legend: **✅ reachable & working** · **🟡 dormant** (code intact, no UI path today) · **⚠️ dead code** · **🏠 venue-specific hardcode** · **✳️ internal/debug**

| Feature | Journey | Status | Where |
|---|---|---|---|
| Chat Q&A (knowledge-driven) | 2.3 | ✅ | `Home.jsx` + `useChatFlow` |
| Date availability (single/multi/month) | 2.4 | ✅ | `useChatFlow` + `checkDateAvailability` |
| Tour booking | 2.5 | ✅ | `TourScheduler` + `createHighLevelAppointment` |
| Human handoff SMS | 2.5 | ✅ | `HandoffContactCard` + `createHighLevelLeadAndNotify` |
| Message feedback → ClickUp | 2.5 | ✅ | `MessageFeedback` + `createClickUpTask` |
| Venue creation + user invites | 2.2 | ✅ | `SuperAdmin` + invite functions |
| Onboarding wizard & ingestion | 2.2 | ✅ | 4 ingestion paths (§2.2 table) |
| Knowledge review/approval | 2.2 | ✅ | `Planner` "Review & Train" |
| Conversations list + CSV export | 2.7 | ✅ | `AdminChatSessions` |
| Transcript viewer | 2.7 | ✅ | `ChatTranscript` + `getChatSessionPublic` |
| Feedback review | 2.7 | ✅ | `Feedback` |
| Wedding calendar (book/block) | 2.7 | ✅ | `AdminCalendar` |
| Google Calendar sync | 2.2/2.8 | ✅ | `GoogleCalendarSync` + `syncGoogleCalendar` |
| HighLevel connection check | 2.2 | ✅ | `HighLevelConnection` + `checkHighLevelConnection` |
| First Look videos | 2.6 | ✅ | `FirstLook` + `FirstLookConfiguration` |
| Dashboard analytics & benchmarks | 2.7 | ✅ | Dashboard components + `getBenchmarkingData` |
| Debug trace | 2.8 | ✅ | `?debug=1` + `DebugTraceButton` |
| Budget calculator | 2.4 | 🟡 **deliberately disabled** ("pending rebuild — vendor pricing changed"); `EnhancedBudgetCalculator` + `SendBudgetForm` + `sendBudgetQuote` + `SavedBudgetEstimate` all intact but unreachable | quick-action case commented out in `useChatFlow` |
| Availability calendar flow | 2.4 | 🟡 component intact, no trigger | `AvailabilityChecker` |
| Packages view | 2.3 | 🟡 component intact, no trigger | `PackagesView` |
| Gallery | 2.6 | 🟡 component intact, no trigger | `VenueGallery` |
| Visualizer | 2.6 | 🟡 component intact, no trigger | `VenueVisualizer` + `generateVenueVisualization` |
| Quick-action chips | 2.3 | ⚠️ `QuickActions.jsx` + `handleQuickAction` never rendered | orphaned |
| "Assign User" form | 2.2 | ⚠️ legacy; requires manual `venue_id` edit | `SuperAdmin` |
| Sugar Lake pricing init | — | 🏠 `initializeSugarLakePricing`, `updateVenueBasePricing`, `getHighLevelWeddingDates`, `listMissingDates`, `sendBudgetQuote` content | backend |
| Sugar Lake custom fields in HighLevel handoff | 2.5 | 🏠 wedding date/guest count/question customFields only for venue `696c4539…` | `createHighLevelLeadAndNotify` |
| Hardcoded production links | 2.2/2.5 | 🏠 `https://myvirtualplanner.app` for invite + transcript URLs | `SuperAdmin`, `createHighLevelLeadAndNotify` |
| `debugAvailability` | — | ✳️ internal diagnostics | backend |

**Known gaps carried over from `SECURITY_AUDIT.md`** (not re-verified here): open RLS reads on several entities (`Venue`, `VenueKnowledge`, `ChatSession.update` null, etc.), an unscoped `BookedWeddingDate.list()` in the chat page (cross-tenant data in memory, display-only), and platform bugs noted in project history (ChatFeedback anonymous-create, ClickUp 500s on anonymous flow).

---

## 7. Synthetic end-to-end examples

### Example A — A couple checks a date, gets a price, and requests a human (happy path + one honest failure)

1. **Entry.** Sugar Lake's website embeds `https://…/?venue=sugar-lake-weddings&embed=1`. Her browser opens it in an iframe; no slug fallback risk because the slug is in the link. Nothing is focused, so the host page doesn't scroll. **[trace: Home.jsx §2.1]**
2. She types "Is Saturday October 23 2027 open? We're thinking about 100 guests". `ensureChatSession()` creates `ChatSession#1`.
3. **Classifier** (`gemini_3_flash`) returns `intent: date_inquiry`, `wedding_date: 2027-10-23`, `stated_weekday: Saturday`, `guest_count: 100`. Weekday guard: 2027-10-23 is a Saturday — no conflict, no clarifying question.
4. **`checkDateAvailability`** (service role) reads `BookedWeddingDate` + `BlockedDate` for this venue only → `isAvailable: true`. Code composes: "Good news — Saturday, October 23, 2027 is open!"
5. `pendingAction` was `awaiting_quote_details` from her earlier "what would it cost?" — so `priceAfterAvailability` fires: the **generator** (`claude-sonnet-5`, forced tool) receives the `packages_pricing` knowledge block + known-bride block (100 guests, 2027-10-23) and returns the price follow-up. She receives verdict + price in one reply. `pendingAction` clears.
6. She replies "Actually, can we add fireworks?" → classifier topic `rules_policies`; knowledge says fireworks aren't allowed; generator answers honestly and sets `needsHandoff: false` (a partial answer beats a handoff).
7. She says "Can I just talk to Saydee then?" → `isDirectPlannerRequest` regex matches → contact card appears **without any LLM call**.
8. She submits name/phone → `createHighLevelLeadAndNotify`: HighLevel contact upserted (Sugar Lake custom fields written), tagged, planner note attached with transcript link `https://myvirtualplanner.app/ChatTranscript?id=<ChatSession#1>`, intro SMS sent from the planner's number, `ChatSession#1` → `handed_off` with lead fields, `HandoffRequest#1` created (`intro_sent`).
9. **Outcome.** She gets a text within seconds; Saydee sees the note + transcript in HighLevel; the venue's Conversations page shows the session with an amber "Handoff" badge; the CSV export includes her as a handoff lead.
10. **Failure variant.** If the SMS send fails at step 8: `HandoffRequest` still records `intro_failed` with the error, the card turns amber ("Your request was saved…"), and the staff Feedback/Conversations data is unaffected. The planner still has the note and can text her manually.

### Example B — New venue from zero to a live chatbot

1. **Admin creates the venue** in `SuperAdmin` (name, slug, timezone, planner name) → `Venue#2` exists; UI warns until the slug is set.
2. **Admin invites the owner** → `createUserInvite` → email sent (7-day token) → owner accepts via `/invite?token=…`, registers with email + OTP → `acceptUserInvite` links the user to `Venue#2` as `venue_owner` → Dashboard loads with "No venue assigned" gone.
3. **Owner trains the bot** (Dashboard → Train Your AI Concierge): the wizard's questionnaire answers → `processOnboardingAnswers` → draft Q&A; a pricing PDF upload → `processVenueDocument` → drafts with page-numbered excerpts; a planner-call transcript → `processTranscriptIntelligence` → more drafts. Owner reviews everything on the Planner page: edits, then **Approve & Activate** — each approval flips `is_active:true, needs_review:false`, and the readiness card's per-topic bars fill.
4. **Owner connects operations**: Settings → Google Calendar sync (their own Google account via the APP_USER connector) → wedding calendar selected → `syncGoogleCalendar` imports 3 years of events into `BookedWeddingDate` (multi-day ranges intact, `CalendarSyncEvent` audit row written, `availability_data_verified` set); HighLevel connection check confirms their location/tour calendar.
5. **Owner books a manual wedding**: Calendar → click an open date → Book Wedding → `BookedWeddingDate` row (no `google_event_id`). They also block July 4 (`BlockedDate`). Both are now honored by every chat availability answer.
6. **Outcome.** The venue's web team embeds `/?venue=<slug>&embed=1`. A bride's "what Saturdays are open in June 2028?" is answered from real data via `monthOpenings`; a tour books into their HighLevel calendar; a handoff SMS comes from their planner's number — all with zero per-venue code changes. The only remaining per-venue step is provisioning their HighLevel credentials (secret prefix in the `highLevelConfig` map) — flagged in §6 as a current hardcode.

---

## 8. Remaining unknowns / areas not traced

Items below are **not claimed as verified**; each needs a read/test before being treated as fact:

1. **Page/component internals not re-read this session** (**[X]**): `VenueSettings.jsx` body (pricing manager, First Look settings specifics), `AdminWeddings.jsx`, `VenueOnboardingWizard.jsx` + `OnboardingReadiness.jsx` (exact readiness math), `PlannerTestChat.jsx`, `MessageFeedback.jsx` UI details, `Register.jsx` / `Invite.jsx` internals, `GoogleCalendarSync.jsx` component, dashboard analytics components, `getBenchmarkingData` internals, `EnhancedBudgetCalculator.jsx` lines 120–1047 (step machine, `SavedBudgetEstimate` write at line 610 confirmed by grep only), `getHighLevelAvailability` slot-mapping details.
2. **Server-session continuity**: whether a reloaded embed continues syncing to the same `ChatSession` (appears to restart server records per page load; localStorage carries the visible transcript — **[INF]**, untested).
3. **`venue_staff` vs `venue_owner` permissions**: verified only for the Feedback page gate; other pages don't distinguish the two roles beyond `venue_id` presence.
4. **Ingestion LLM models**: exact model/version used by `processVenueDocument`, `processTranscriptIntelligence`, `processOnboardingAnswers` not traced this session.
5. **`venue_staff` user creation path for venues other than Sugar Lake**: the HighLevel secret-prefix map currently contains one non-default venue; how new venues' credentials are provisioned is a manual/ops step (no UI).
6. **Runtime behavior of published production data** (RLS enforcement in practice, actual HighLevel calendar states, Google connection health) — static source review cannot confirm; requires authenticated testing in a clone.
7. **Cross-tenant leakage surfaces** flagged in `SECURITY_AUDIT.md` (e.g. `Home.jsx` unscoped `BookedWeddingDate.list()`, open reads on `Venue`/`VenueKnowledge`/`ChatSession.update:null`) remain open unless remediated after this document.