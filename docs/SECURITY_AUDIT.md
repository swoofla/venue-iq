# Virtual Planner — Technical Audit Report (§1–§6)

**Scope discipline:** inspection and documentation only. No code, permissions, records, integrations, or deployment settings modified. No production functions invoked, no messages sent, no records read beyond schema/source files. Secret values and customer records were not accessed or exposed.

**Revision statement (fresh inspection):**
- Working tree HEAD: `72465058ed6d65baf80696ff94b70f9ac5990213`, branch `main`, remote `origin → github.com/swoofla/venue-iq.git` (credential in the remote URL redacted and must not be committed or shared).
- `git diff fdb858a2cebcc73986a83710499e5157ebde4a1f` shows exactly one file changed: `public/TECHNICAL_HANDOFF.md` (+451 lines, new file — the earlier report exported at the user's request). All source, entity, and function files are byte-identical to the GitHub-inspected commit. Every finding below describes the code at `fdb858a`.

**Evidence labels:** **[SV]** source-verified (read this session, path cited) · **[PV]** platform-verified (official Base44 capability guide/docs) · **[INF]** inferred · **[X]** unknown/inaccessible from this assistant. No runtime testing was performed — all exploitability statements are source-confirmed / runtime-unverified.

---

## §1. Authorization findings — corrected and investigated

**Preliminary platform fact:** each deployed backend function gets a public HTTP endpoint; direct HTTP calls carry **no authenticated user context**, and any authentication/authorization must live in the function's own code. **[PV]** There is no documented dashboard setting that restricts per-function invocation to a role — **[X]** if any such toggle exists it would be on the dashboard Code → Functions page; a screenshot of that page per function would close this. Function names are embedded in the published JS bundle (`base44.functions.invoke('<name>')`), so endpoint URLs are not secret. **[SV]**

### 1.1 `createUserInvite` — CORRECTED: no caller authentication or permission check exists. Previous report was wrong.

1. **Source evidence [SV]** `base44/functions/createUserInvite/entry.ts`: line 5 creates the client; line 6 destructures `{ email, name, venue_id, role, created_by }` from the request body and proceeds directly. The only checks are field validation (lines 8–20), venue existence (line 22, service-role read), pending-invite expiry (lines 27–37), and existing-user rejection (lines 39–49). Then `UserInvite.create` via **service role** (lines 56–65) and `Core.SendEmail` to the caller-supplied address (lines 79–106). **No `base44.auth.me()` call anywhere in the file.** The previous report's "permission validation" claim was incorrect — full retraction.
2. **Who can invoke:** anyone who can reach the endpoint, unauthenticated included. **[SV]**
3. **Platform protection outside source:** none found; endpoint is public by platform design **[PV]**.
4. **Status: source-confirmed (missing check).** Runtime exploitability unverified.
5. **Severity chain [INF]:** combined with `acceptUserInvite` (also unauthenticated, token-gated only), an anonymous caller could mint a `venue_owner` invitation for **any venue** to an address they control, then accept it. Also an open email-send vector (arbitrary `to` address).
6. **Proposed repair (not implemented):** admin-only pattern per platform guide — `const user = await base44.auth.me(); if (!user) 401; if (user.role !== 'admin') 403;`. **Regression checks:** anonymous POST → 401; venue_owner/staff POST → 403; admin POST → invite created, `email_sent`/`email_error` behavior unchanged; duplicate-pending expiry and existing-user rejection unchanged; `SuperAdmin.jsx` invite flow still works end-to-end (sole caller).

### 1.2 `getChatFeedback` — CONFIRMED: service-role bulk read with no caller check

1. **Source evidence [SV]** `getChatFeedback/entry.ts` (25 lines): line 5 parses optional `{ rating, venue_id, limit }` (`catch(() => ({}))`); line 10 `base44.asServiceRole.entities.ChatFeedback.list()` — **all records, all venues**; lines 12–18 sort and filter in memory. No `auth.me()` and no role/venue check. The caller-supplied `venue_id` filter filters, it does not authorize.
2. **Who can invoke:** anyone with the endpoint URL. **[SV]**
3. **Platform protection:** none at the function layer; entity RLS is irrelevant because the read is service-role **[PV]**.
4. **Status: source-confirmed.** High severity: `ChatFeedback` records contain full `transcript` and `debug_trace` objects **[SV]** schema + `useChatFlow.jsx` payload.
5. **Proposed repair:** `auth.me()` → 401; if `user.role !== 'admin'`, require `venue_id` and enforce `user.venue_id === venue_id` (403 otherwise); admin may omit `venue_id`. **Regression checks:** anonymous → 401; staff with own `venue_id` → own-venue records only; staff with foreign `venue_id` → 403; admin with no filter → all records. This function currently has **no frontend caller** — `Feedback.jsx:32` reads `ChatFeedback` via the entity SDK under RLS — so locking it breaks no UI flow.

### 1.3 `clearSyncedDates` — CONFIRMED: authentication only; no venue ownership; deletes ALL bookings, not only synced ones

1. **Source evidence [SV]:** lines 6–10 `auth.me()` → 401 if absent; line 13 `venue_id` taken from the body **with no comparison to `user.venue_id` and no admin check**; line 20 service-role `filter({ venue_id })` selects **every** `BookedWeddingDate` for the supplied venue; lines 25–35 delete them in batches. **No `google_event_id` / `google_calendar_id` filter** — manually entered bookings are deleted along with synced ones.
2. **Who can invoke:** any authenticated app user, including staff of a *different* venue. **[SV]**
3. **Platform protection:** none beyond login; service-role delete bypasses RLS **[PV]**. The in-app caller (`AdminCalendar.jsx`) always passes the user's own venue — caller-side behavior, not enforcement.
4. **Status: source-confirmed (ownership gap + over-broad delete).** Runtime unverified.
5. **Proposed repair:** (a) ownership check identical to `syncGoogleCalendar/entry.ts:65` — `if (user.role !== 'admin' && (!user.venue_id || user.venue_id !== venueId)) return 403;` (pattern already exists in this codebase); (b) if the intent is "clear *synced* dates," restrict the filter to records having `google_event_id`, or expose an explicit confirm flag for a full wipe. **Regression checks:** staff of venue A passing venue B → 403; admin unchanged; manual bookings survive a synced-only clear; AdminCalendar UI still works for the venue's own staff.

### 1.4 `generateAutoKnowledge`, `processOnboardingAnswers`, `processTranscriptIntelligence` — CONFIRMED: authentication only, no venue authorization (service-role writes to arbitrary venues)

| Function | AuthN | AuthZ (venue) | Privileged actions [SV] |
|---|---|---|---|
| `generateAutoKnowledge/entry.ts` | line 6 `auth.me()` → 401 | **none** | service-role reads `Venue`, `VenuePackage`, `WeddingPricingConfiguration`, `VenueKnowledge`; **creates** `VenueKnowledge` drafts and **creates/updates** `VenueOnboardingProgress` for the caller-supplied `venue_id` |
| `processOnboardingAnswers/entry.ts` | line 6 → 401 | **none** | service-role `Venue.get`, LLM call, **creates** `VenueKnowledge` drafts, **creates/updates** `VenueOnboardingProgress` for any `venue_id` |
| `processTranscriptIntelligence/entry.ts` | line 172 → 401 | **none** | LLM call, **creates** `VenueKnowledge` rows for any `venue_id` |

1. **Source evidence:** each file checks `auth.me()` (authentication) then trusts the caller-supplied `venue_id` for all service-role reads/writes. No `user.venue_id` comparison in any of the three files **[SV]**.
2. **Who can invoke:** any authenticated app user — a staff member of venue A can ingest drafts into venue B's knowledge pipeline, corrupt venue B's `VenueOnboardingProgress` status, and consume integration credits **[SV]**.
3. **Platform protection:** none; service role bypasses RLS **[PV]**. Contrast: `processVenueDocument/entry.ts:81-83` **does** authorize (`user.role !== 'admin' && user.venue_id !== venue_id` → 403) **[SV]**, as do `syncGoogleCalendar:65`, `checkHighLevelConnection:9`, and `getChatSessionPublic:26`. The correct pattern exists and is simply missing from these three.
4. **Status: source-confirmed for all three.** Runtime unverified.
5. **Proposed repair:** add the identical venue-ownership check used by `processVenueDocument` at the top of each. **Regression checks:** staff invoking for own venue unchanged; staff invoking for foreign venue → 403; admin unchanged; draft rows still `is_active: false, needs_review: true` (verify no live-KB write); onboarding progress status for the correct venue only.

### 1.5 Remaining functions checked this pass

- Anonymous (no authN): `checkDateAvailability`, `invokeAnthropicGenerator`, `sendBudgetQuote`, `createHighLevelContact`, `createHighLevelAppointment`, `getHighLevelAvailability`, `debugAvailability`, `listMissingDates`, `getHighLevelWeddingDates`, `validateUserInvite`, `acceptUserInvite`, `createClickUpTask`, `createChatFeedback` **[SV]**.
- AuthN + AuthZ verified: `syncGoogleCalendar`, `getChatSessionPublic`, `checkHighLevelConnection`, `getBenchmarkingData`, `initializeSugarLakePricing`, `updateVenueBasePricing`, `processVenueDocument` (except `clearSyncedDates`, see 1.3) **[SV]**.
- No live exploit was demonstrated — all findings are source-confirmed missing controls, runtime-unverified.

---

## §2. Platform configuration absent from GitHub

| Item | Status | Where to confirm |
|---|---|---|
| App visibility & login requirement | **[X] not accessible from this assistant.** Strong inference the app is public (bride chatbot requires no login; anonymous `ChatSession` creation works) — **[INF]** from `src/pages/Home.jsx` + platform auth semantics. | **App Settings** dashboard page — screenshot needed. |
| Enabled sign-in methods & registration restrictions | Code proves **email/password + OTP verification** (register → `verifyOtp` → `loginViaEmailPassword`) **[SV]** `src/pages/Register.jsx`; manual email/password login on invite accept **[SV]** `src/pages/Invite.jsx`. Google/Microsoft/etc.: **[X]**. | **Authentication** dashboard page — screenshot needed. |
| Function invocation permissions | No per-function role gating exists in code or documented platform config; functions are public HTTP endpoints; auth is the function's own responsibility **[PV + SV]**. | **Code → Functions** dashboard page, per function — screenshot needed. |
| Service-role access | `base44.asServiceRole` bypasses entity RLS, available to all function code with no configuration gate **[PV]**. | Inherent — no dashboard location. |
| Dashboard automations, schedules, agents, webhooks | **None in source:** no `base44/workflows/`, no `base44/agents/`, no webhook-receiving functions (all 28 are request/response handlers) **[SV]**. Dashboard-side configs, if any, are **[X]**. | Dashboard **Workflows / Agents** sections — screenshot needed. |
| Preview vs published separation | **Database:** preview and published share the production database **unless** testing mode is on in preview (separate test data; published always uses production data) **[PV]**. **Secrets:** app-level, shared; a replaced value applies to preview immediately but to the published app only after republish **[PV]**. | App Settings (test data toggle) — screenshot optional. |
| GitHub sync | **[SV]** repo connected: `origin → github.com/swoofla/venue-iq.git`, branch `main` (only supported branch for sync **[PV]**), sync is automatic Base44→GitHub for builder edits and GitHub→Base44 on merge to `main` **[PV]**; publishing is a separate manual step **[PV]**. Working tree is 1 commit ahead of inspected `fdb858a` (only `public/TECHNICAL_HANDOFF.md` added). | Confirmed from git metadata + platform docs. |
| Publishing, revision recovery, export, backup | **[PV]** Version History supports **Revert to this version** and **Publish this version** (correcting the earlier "no deployment history" claim); **Dashboard → Data → More actions (⋯) → Export** downloads per-table CSV. No full-app bundle export documented. | Dashboard Version History + Data pages. |

---

## §3. Effective entity permissions (all 20 schemas inspected fresh)

### 3.1 RLS semantics — resolved against the authoritative platform guide **[PV]**

| Question | Answer |
|---|---|
| What `null` (or `{}`/`true`/omitted key) means | The operation is **open to everyone, including anonymous visitors on public/no-login apps**. |
| Entire `rls` block absent | Same — all four operations open. |
| `{{user.venue_id}}` vs `{{user.data.venue_id}}` | Documented templates are `{{user.id}}`, `{{user.email}}`, `{{user.role}}`, `{{user.data.<field>}}`. **`{{user.venue_id}}` is not a documented form.** It appears in 7 entities (see matrix) and is **suspected to resolve to nothing** for non-admin users, effectively collapsing those rules to admin-only — **[SV]** where it appears, **[X]** runtime behavior unverified. |
| Anonymous users | Absent user context; can only act where rules are null/absent — here: `create` on ChatSession, ContactSubmission, SavedBudgetEstimate, CalendarSyncEvent, ChatFeedback **[SV]**. |
| Update rule validation | A top-level `update` rule authorizes the **existing** record before new values apply — it gates who may edit, **not which fields**. Owners can change their own record's `venue_id`; the move itself succeeds. No field-level protection exists in RLS. |
| Can owners/staff modify their own `venue_id` or role | **User records are platform-managed**: a top-level `rls` on `User` is *not applied*; only admins list/update/delete other users. `User.jsonc` declares only `venue_id` **[SV]**. The only code path that sets them is `acceptUserInvite` (service-role, token-gated) **[SV]**. |
| Service role | Bypasses all of the above **[PV]** — relevant to §1. |

### 3.2 Permission matrix (declared schema rules, all 20 **[SV]**; none runtime-verified)

| Entity | create | read | update | delete | Notes |
|---|---|---|---|---|---|
| Venue | admin | **null (open, incl. anonymous)** | own-venue (`{"id":"{{user.data.venue_id}}"}`) or admin | admin | Update rule references record `id` — valid form |
| User | platform-managed | built-in | admins only (built-in) | admins only (built-in) | `venue_id` is the only custom field |
| UserInvite | admin | admin | admin | admin | |
| ChatSession | **null** | venue-or-admin | **null** | venue-or-admin | **⚠ unrestricted create + update** — any authenticated user (or anonymous) can create sessions under any `venue_id` and **overwrite any session's messages/lead fields** |
| VenueKnowledge | venue-or-admin | **null** | venue-or-admin | venue-or-admin | **Public read includes `is_active:false` and `needs_review:true` drafts** — the chatbot filters client-side, RLS does not |
| VenueOnboardingProgress | venue | venue | venue | venue | all `{{user.data.venue_id}}` |
| **VenueOperatingRules** | **no `rls` key → OPEN** | **OPEN** | **OPEN** | **OPEN** | **⚠ fully open CRUD including anonymous writes on a public app** |
| VenuePackage | venue (`{{user.venue_id}}`†) | null | venue† | venue† | † legacy template form, see §3.1 |
| WeddingPricingConfiguration | venue† | null | venue† | venue† | |
| BookedWeddingDate | venue-or-admin | venue-or-admin | venue-or-admin | venue-or-admin | |
| BlockedDate | venue | venue | venue | venue | |
| CalendarSyncEvent | **null** | venue-or-admin | admin | admin | |
| HandoffRequest | venue | venue | venue | venue | contains lead PII; protected |
| ContactSubmission | **null** | venue† | venue† | venue† | read rule venue-scoped (not admin-inclusive) — admins cannot read via entity API directly |
| SavedBudgetEstimate | **null** | **null (open, incl. anonymous)** | venue† | venue† | **⚠ open read of name/phone/email/budget PII** |
| ChatFeedback | **null** | admin-or-venue† | admin-or-venue† | admin-or-venue† | |
| VenuePhoto | venue† | null | venue† | venue† | |
| VenueVisualizationPhoto | venue† | null | venue† | venue† | |
| VisualizerHeroImage | admin | **null** | admin | admin | |
| FirstLookConfiguration | venue† | null | venue† | venue† | |

### 3.3 Synthetic test plan (separate environment only — not executed)

In a clone with test data mode on: (1) create staff test users for venues A and B; (2) as staff-A, attempt entity-SDK reads/writes against venue-B records across the ⚠-marked entities (ChatSession update, SavedBudgetEstimate read, VenueKnowledge inactive read, VenueOperatingRules CRUD) — expect them to succeed under the declared rules, documenting the gap; (3) repeat with `{{user.venue_id}}`-† entities to resolve whether that template form works (decides 7 entities' staff access); (4) as anonymous, repeat create on the five `create:null` entities. No production records touched.

---

## §4. External integrations and operational dependencies

**Google Calendar OAuth**
- Connector: workspace-registered **"Google Cloud Console for Calendar"** (id `6a2b72d0b1ae3cefb36ece05`), own OAuth client, `connector_mode: all`; registered scopes **`email` + `https://www.googleapis.com/auth/calendar.readonly`** **[PV]**.
- Mode in use: **APP_USER** — `syncGoogleCalendar` uses the current app user's token so **each venue staff member connects their own Google account**; the synced calendar id is persisted per venue (`Venue.google_calendar_id`) **[SV]**. Sync direction is **one-way Google→app, read-only scope** — no calendar writes possible with this grant.
- Callback URL: platform-managed redirect; exact value lives in the Google Cloud Console OAuth client config maintained by the workspace admin — **[X]**, confirm via Settings → OAuth Connectors screenshot.
- Webhook support exists (`events`) but **no workflow consumes it** **[SV]**.

**HighLevel (GoHighLevel)**
- Venue→account routing is a **hardcoded map in 5 functions** (`checkHighLevelConnection`, `createHighLevelContact`, `createHighLevelAppointment`, `createHighLevelLeadAndNotify`, `getHighLevelAvailability` — identical `highLevelConfig()`) **[SV]**: venue `696c4539ef1c68d790d9c6a0` → unprefixed secrets; venue `6aac0d32b262b9e75ba4515d` → `CONRAD_`-prefixed. Comment: *"Never fall back to another venue's account"* — unmapped venue IDs return `{}` → functions fail closed (e.g. 503 "Planner texting is not connected") **[SV]**. Exception: `createHighLevelLeadAndNotify` also carries a hardcoded Conrad `fromNumber: '+15155376420'` **[SV]** (real phone number in source — treat as PII-adjacent, not a secret).
- Credential names: `HIGHLEVEL_API_KEY`, `HIGHLEVEL_LOCATION_ID`, `HIGHLEVEL_TOUR_CALENDAR_ID` (+ `CONRAD_` variants); `HIGHLEVEL_WEDDING_CALENDAR_ID` (Sugar Lake wedding-date pulls only). All 12 exist as app secrets **[PV]**.
- **`sendBudgetQuote` — CONFIRMED: always uses the unprefixed credentials regardless of venue.** Lines 23–24 read `HIGHLEVEL_API_KEY`/`HIGHLEVEL_LOCATION_ID` with no prefix map, no `venueId` routing, and no auth; the function also hardcodes Sugar Lake content: phone `(216) 616-1598` in SMS/email, `sugarlakeweddings.com` CTA, default domain fallback **[SV]**. Any venue other than Sugar Lake using this path would push leads into the **Sugar Lake** HighLevel subaccount with Sugar Lake branding. **Source-confirmed; runtime unverified.**

**Anthropic** — `invokeAnthropicGenerator/entry.ts` **[SV]**: `api.anthropic.com/v1/messages`, `anthropic-version: 2023-06-01`, model **`claude-sonnet-5`**, `max_tokens: 2000`, forced tool `reply` → `{needsHandoff*, topicSummary, acknowledgment, answer*}`, **60 s AbortController timeout**, no auth, no rate limiting in code. Quotas are Anthropic-account-side — **[X]**. Runs on the app owner's API key **[SV]**.

**Stability AI** — `generateVenueVisualization/entry.ts` **[SV]**: SDXL `stable-diffusion-xl-1024-v1-0`, inpainting/masking endpoint when a mask is provided, else img2img (image_strength 0.30); cfg_scale 8; steps 40/35; 1 sample; negative prompt block; no auth; quotas **[X]**.

**ClickUp** — `createClickUpTask`: `CLICKUP_API_TOKEN` + `CLICKUP_FEEDBACK_LIST_ID`; failures returned with HTTP 200 (soft-fail by design) **[SV]**.

**Email** — `Core.SendEmail` (platform): invite delivery only; recipient-hygiene/limits platform-side **[PV]**.

**File storage** — `Core.UploadFile` (public, world-readable URLs) for photos and venue documents **[SV]**; `pdfjs` worker pinned 4.10.38 in `public/` **[SV]**.

**Caller-provided URL handling (functions that fetch URLs):**
- `generateVenueVisualization` **[SV]**: `baseImageUrl` and `maskImageUrl` fetched server-side with **no scheme/host allowlist, no download size limit** (`arrayBuffer()` unbounded), **no fetch timeout** (platform execution timeout only), default redirect-following. The only in-app caller passes storage URLs from `VenueVisualizationPhoto`, but the endpoint accepts any URL — an **SSRF/data-fetch vector, source-confirmed, runtime-unverified**. Proposed repair (not implemented): allowlist to the app's own storage domain(s) + max-bytes check + timeout.
- `processVenueDocument` **[SV]**: accepts `file_url` (validated only for presence), passes it to `InvokeLLM` as evidence; proper venue authz (lines 81–83) but no URL allowlist; size gates exist only for caller-supplied metadata (`file_size > 8 MB`, `document_text` ≤ 150 000 chars).
- `sendBudgetQuote` **[SV]**: caller-supplied `venueDomain` interpolated into quote links sent by SMS/email/note without validation (link-injection into outbound messages).
- All URL handling is code-level; no platform egress restriction is documented **[X]**.

---

## §5. Complete technical reference (corrections to the prior report)

### 5.1 Corrected file inventory at `fdb858a` **[SV]**

`src/components/chat` **12** (ChatEmptyState, ChatInput, ChatMessage, ChatVideoMessage, DebugTraceButton, HandoffContactCard, ImageCarouselMessage, MessageFeedback, ProgressDots, QuickActions, TypingIndicator, VenuePickerScreen) · `src/components/flows` **9** (AvailabilityChecker, BudgetCalculator, BudgetSummaryBreakdown, EnhancedBudgetCalculator, PackagesView, SendBudgetForm, TourScheduler, VenueGallery, VenueVisualizer) · `src/components/hooks` **10** (buildClassifierPrompt, buildGeneratorPrompt, composeAvailabilityReply, dateHelpers, flowCompletionHandlers, handoffIntent, parseDateFromText, parseDatesFromText, parseMonthsFromText, useChatFlow) · `src/components/admin` **17** (BlockDateForm, CalendarView, FeaturedPhotosManager, FirstLookSettings, GoogleCalendarSync, HighLevelConnection, PlannerTestChat, PricingManager, TranscriptUpload, VenueDocumentUpload, VenueEditForm, VenueOnboardingWizard, VenueSelector, WeddingForm, onboardingQuestions, onboardingSteps, prepareVenuePdf). Pages 13, entities 20, functions 28, workflows/agents/shared **0** **[SV]**. Previous report's counts (13/11/12/16) were wrong and are corrected here.

### 5.2 Every entity field (types/defaults/required — fresh schema reads **[SV]**; built-ins id/created_date/updated_date/created_by_id omitted)

- **Venue**: name* string; slug; description; location; phone; email (fmt); website; domain; timezone default `"America/New_York"`; head_planner_name (no default, deliberate); planner_name default `"our planner"`; planner_title default `"our planner"`; google_calendar_id; availability_data_verified bool default false.
- **User**: venue_id* string (only custom field).
- **UserInvite**: email* (fmt); name; venue_id*; role* enum[venue_owner, venue_staff]; token*; status enum[pending, accepted, expired] default pending; expires_at (date-time); accepted_at (date-time).
- **ChatSession**: venue_id*; lead_name; lead_phone; lead_email; lead_wedding_date (YYYY-MM-DD); lead_guest_count number; lead_budget_range; messages[] {role enum[bot,user], content, timestamp} default []; flows_completed[] string default []; flow_results{} default {}; handoff_offered bool default false; handoff_accepted bool default false; handoff_triggered bool default false; handoff_topic; status enum[active, handed_off, abandoned, completed] default active.
- **VenueKnowledge**: venue_id*; question*; answer*; category enum[faq, pricing, pricing_nuance, capacity, policy, amenities, ceremony_spaces, lodging, sales_workflow, objection_handling, brand_voice, vendor_info, seasonal, location_directions, human_handoff] default faq; topic enum[catering, desserts, alcohol_bar, packages_pricing, ceremony_spaces, reception_spaces, lodging, coordination_planning, payment_deposits, decor_rentals, photography_video, capacity_guests, vendors, rules_policies, amenities, availability_dates, tours, getting_ready, general] default general; is_active bool default true; priority number default 5; tags[]; source enum[manual, transcript, imported] default manual; confidence number; needs_review bool default false; source_excerpt; source_page integer. **Note: no `other` category value, yet `processOnboardingAnswers` maps section `personality` → category `'other'` — a schema/producer mismatch (source-verified both sides).**
- **VenueOnboardingProgress**: venue_id*; overall_progress number default 0; section_venue_basics/spaces/policies/faq/personality/packages/pricing/transcripts enums[not_started, in_progress, complete, auto_complete] default not_started; answers_venue_basics/spaces/policies/faq/personality {} default {}; topic_answers{} default {}; topic_status{} default {}; knowledge_generated_at (date-time); knowledge_count number default 0.
- **VenueOperatingRules**: venue_id*; months[] {month 1-12, pricing_season 'peak'|'off', full_weddings bool, full_wedding_max_guests number|null, micro 'yes'|'no'|'case_by_case', micro_days, elopements bool, elopement_days}; blocked_holidays[] {rule 'fixed'|'nth_weekday', month, day, weekday 0-6, nth, label, note}; tent_months[] number; tent_alternative_months[] number; tent_alternative_space; notes; is_active bool default true. **No RLS block.**
- **VenuePackage**: venue_id*; name*; price* number; max_guests* number; description; includes[]; sort_order default 0; is_active default true.
- **WeddingPricingConfiguration**: venue_id*; pricing_data*{} — nested grid: venue_base.{up_to_2, 2_to_20, 20_to_50, 51_to_120}.{weekday_peak, saturday_peak, friday_peak, sunday_peak, saturday_non_peak, friday_non_peak, sunday_non_peak, weekday_non_peak}.{price, per_person} (subset per tier); spirits[]/catering[] {guest_tier, options[] {label, price_type enum[flat, per_person], price}}; planning[]/photography[]/florals[]/decor[]/entertainment[]/videography[]/desserts[]/linens[]/tableware[] {guest_tier, options[] {label, price}}; extras_options[] number.
- **BookedWeddingDate**: venue_id*; date* (date); end_date (date); couple_name; email; phone; guest_count; package enum[intimate_garden, classic_elegance, grand_estate]; notes; deposit_paid bool default false; google_event_id; google_calendar_id; merged_into_id.
- **BlockedDate**: venue_id*; date* (date); reason.
- **CalendarSyncEvent**: venue_id; action* enum[list_calendars, sync_calendar]; status* enum[connected, not_connected, error]; error_message; user_id.
- **HandoffRequest**: venue_id*; chat_session_id*; lead_name*; lead_phone*; lead_email; topic_summary*; original_question*; ghl_lead_contact_id; ghl_intro_message_id; ghl_note_id; transcript_url; status enum[pending, intro_sent, intro_failed, completed] default pending; error_message.
- **ContactSubmission**: venue_id*; name*; email* (fmt); phone; wedding_date (date); guest_count; tour_date (date); tour_time; budget number; priorities[]; recommended_package; notes; source enum[budget_calculator, tour_scheduler, availability_check, chat]; status enum[new, contacted, tour_scheduled, booked, lost] default new.
- **SavedBudgetEstimate**: venue_id*; name*; email; phone; delivery_preference* enum[text, email]; total_budget* number; guest_count* number; guest_tier*; day_of_week*; season* enum[peak, nonpeak]; budget_selections* {}; budget_breakdown* {}; highlevel_contact_id; highlevel_sync_status enum[pending, synced, failed] default pending.
- **ChatFeedback**: rating ('up'/'down' by convention, free string); comment; flagged_message; preceding_user_message; transcript object; debug_trace object; chat_session_id; venue_id. required [].
- **VenuePhoto**: venue_id*; category* enum[ceremony, reception, grounds, details, bridal_suite, exterior]; image_url*; caption; alt_text; sort_order default 0; is_featured default false; is_active default true.
- **VenueVisualizationPhoto**: venue_id*; name*; category* enum[ceremony, reception, cocktail, outdoor, detail]; photo_url*; photo_description; transformation_hints; mask_url; aspect_ratio enum[16:9, 4:3, 1:1, 9:16] default 16:9; is_active default true; sort_order default 0.
- **VisualizerHeroImage**: category* enum[vibe, density, colors, season]; option_id*; image_url*; label*; description; prompt*; colors[]; sort_order default 0; is_active default true.
- **FirstLookConfiguration**: venue_id*; is_enabled default true; welcome_video_id; welcome_video_thumbnail; host_name; host_title default "Owner & Head Planner"; welcome_text default "let me show you around."; video_options[] {id, label, video_id}.

### 5.3 Request/response contracts + callers for all 28 functions **[SV unless noted]**

| Function | Request | Response / errors | AuthN | Frontend caller |
|---|---|---|---|---|
| acceptUserInvite | {token*, name} | success + user linking; 400/404/500 | token-gated | `Invite.jsx` |
| checkDateAvailability | {venueId*, date*, alternativesCount=3, mode='single'\|'monthOpenings', weekdays[], monthOpeningsLimit=12} | {isAvailable, alternatives[]} \| {monthOpenDates[], count}; 400/500 | none (by design) | `useChatFlow.jsx`, `AvailabilityChecker.jsx` |
| checkHighLevelConnection | {venueId*} | {connected, message}; 401/403/500 | ✔+authz | `HighLevelConnection.jsx` |
| clearSyncedDates | {venue_id*} | {success, deleted}; 401/400/500 | ✔ only | `AdminCalendar.jsx` |
| createChatFeedback | pass-through {venue_id, rating, comment, flagged_message, preceding_user_message, transcript{}, debug_trace{}} | {success, id}; 500 if record doesn't persist (get-verify workaround) | none | **NO CALLER** |
| createClickUpTask | {comment, flagged_message, preceding_user_message, chat_session_id, venue_id, feedback_id} | {success, taskId}; errors still HTTP 200 | none | `useChatFlow.jsx` |
| createHighLevelAppointment | {venueId, contact/appointment fields} | {success, appointmentId, contactId}; 500/503 | none | `flowCompletionHandlers.jsx` |
| createHighLevelContact | {venue_id, name, email, phone, …} | {success, contactId} \| {success, fallback:true, error…}; 400/500 | none | **NO CALLER** |
| createHighLevelLeadAndNotify | {venueId*, chatSessionId*, leadName*, leadPhone*, leadEmail, topicSummary*, originalQuestion*} | {success, handoffId, leadContactId, messageId, transcriptUrl}; 400/503/500 | none (+venue-session match) | `HandoffContactCard.jsx` |
| createUserInvite | {email*, venue_id*, role*, name, created_by} | {success, invite_id, invite_url, token, expires_at, email_sent, email_error}; 400/404/500 | **none** | `SuperAdmin.jsx` |
| debugAvailability | {selectedDate} | diagnostic payload; 500 | none | **NO CALLER** |
| generateAutoKnowledge | {venue_id*, source* ∈ [venue_basics, packages, pricing, all]} | {success, created, updated:0, skipped}; 401/400/404/500 | ✔ only | `VenueSettings.jsx` |
| generateVenueVisualization | {baseImageUrl*, prompt*, maskImageUrl} | {success, image(dataURL), mode}; 400/500 | none | `VenueVisualizer.jsx` |
| getBenchmarkingData | {} | aggregate metrics (totalVenues, …); 401/500 | ✔ | `IndustryBenchmarks.jsx` |
| getChatFeedback | {rating, venue_id, limit} (all optional) | {records[]}; errors still 200 | **none** | **NO CALLER** (`Feedback.jsx` uses entity SDK) |
| getChatSessionPublic | {id*} | {session {id, venue_id, venue_name, venue_domain, lead_*, messages[], flows_completed[], flow_results{}, handoff_topic, status, created_date, updated_date}}; 400/401/404/500 | ✔+authz | `ChatTranscript.jsx` |
| getHighLevelAvailability | {startDate*, endDate*, venueId*} | tour slots; 400/503 | none | `TourScheduler.jsx` |
| getHighLevelWeddingDates | {startDate, endDate} | {success, availableDates, bookedDates, totalDays}; 500 | none | **NO CALLER** (Sugar Lake only) |
| initializeSugarLakePricing | {venueId} | {success, message}; 401 (admin) | ✔ admin | **NO CALLER** |
| invokeAnthropicGenerator | {prompt*} | {result {needsHandoff, topicSummary, acknowledgment, answer}}; 400/500/502; 60 s abort, 2000 max tokens, claude-sonnet-5 | none (by design) | `useChatFlow.jsx` |
| listMissingDates | {} (dates hardcoded 2026-01-18→2027-01-17) | missing-date diff; 500 | none | **NO CALLER** |
| processOnboardingAnswers | {venue_id*, answers*, section_id\|topic, regenerate(ignored)} | {success, created, skipped, total}; 401/400/404/500 | ✔ only | `VenueOnboardingWizard.jsx` |
| processTranscriptIntelligence | {venue_id*, transcript*, pass* ∈ [pricing, capacity, policies, amenities, brand_voice, handoff]} | {success, pass, extracted, saved, skipped_duplicates}; 401/400/500 | ✔ only | `TranscriptUpload.jsx` |
| processVenueDocument | {venue_id*, file_url*, document_name, document_text, page_count, file_size} | {success, created, skipped, extracted, duplicates, invalid, page_count, byTopic, topicsFound, topicsMissing, document_name}; 401/403/400/422/500 | ✔+authz | `VenueDocumentUpload.jsx` |
| sendBudgetQuote | {name*, deliveryPreference* ∈ [text,email], budgetData*, totalBudget*, email, phone, venueName, venueDomain, estimateId} | {success, message, deliveryStatus, deliveryPreference, highlevelContactId}; 400/500 | none | `EnhancedBudgetCalculator.jsx`, `SendBudgetForm.jsx` |
| syncGoogleCalendar | {action*, calendarId, venueId} | list_calendars → {calendars[]}; sync_calendar → sync summary; 401/403/400 invalid action | ✔+authz | `GoogleCalendarSync.jsx` |
| updateVenueBasePricing | {configId*, venueBaseUp_to_2} | success; 401 (admin)/500 | ✔ admin | **NO CALLER** |
| validateUserInvite | {token*} | {success, invite {email, name, role, venue_id, venue_name, status}}; 400/404 | token-gated | `Invite.jsx`, `Register.jsx` |

**Functions with no discovered caller (8):** `createChatFeedback`, `createHighLevelContact`, `debugAvailability`, `getChatFeedback`, `getHighLevelWeddingDates`, `initializeSugarLakePricing`, `listMissingDates`, `updateVenueBasePricing` — confirmed by a repo-wide `functions.invoke('<name>')` sweep. Several are exactly the anonymous/no-auth ones flagged in §1, which raises their risk profile (nothing in-app depends on them).

### 5.4 Build/test commands & environment **[SV]**

- Scripts: `dev` = `vite`; `build` = `vite build`; `preview` = `vite preview`; `lint` = `eslint . --quiet`; `lint:fix`; `typecheck` = `tsc -p ./jsconfig.json`. **No test script** — tests are 4 standalone `node tests/*.mjs` files (`handoff-session`, `booking-ranges`, `availability-reply`, `highlevel-routing`).
- Frontend env: `BASE44_LEGACY_SDK_IMPORTS` (optional, `vite.config.js`). Backend secrets (12 names, all present **[PV]**). No `.env` file required — the vite plugin injects app context.

### 5.5 Running locally vs running independently

- **Frontend locally (`npm run dev`):** runs Vite against the **live Base44 backend** — entities, functions, auth, storage, secrets all execute on the platform. Preview can be switched to test data **[PV]**. The Deno functions cannot execute outside the platform without rewriting the SDK bindings (`createClientFromRequest`, `asServiceRole`).
- **Complete independence:** requires replacing — auth/session backend, entity store + RLS engine (schemas are declarative, not a portable DB), `Core.InvokeLLM/SendEmail/UploadFile`, connector token management, function runtime/hosting, and the invite-email path — plus re-provisioning all 12 secrets, both HighLevel subaccounts, the Anthropic/Stability/ClickUp accounts, and re-consenting Google OAuth per user.

### 5.6 Migration extras (beyond GitHub code)

1. **Entity data:** Dashboard → Data → ⋯ → Export (CSV per table) **[PV]** — no single-click full export.
2. **Uploaded files:** stored in Base44 public storage with URLs referenced by VenuePhoto, VenueVisualizationPhoto, VisualizerHeroImage, FirstLookConfiguration thumbnails, and document uploads — the binaries must be downloaded separately; no storage-export tool is documented **[X]**.
3. **Secrets:** 12 values must be re-entered by hand (never export values into the repo).
4. **Connector:** re-register the Google OAuth client + re-consent each venue user.
5. **Custom domains / DNS:** per-venue CNAME + SSL (wildcards unsupported — project memory, consistent with platform docs).
6. **Version History** as a safety net before migration (revert/publish-version) **[PV]**.

---

## §6. Completeness statement

- **Fully inspected this session (fresh):** the six flagged functions in full (`createUserInvite`, `getChatFeedback`, `clearSyncedDates`, `generateAutoKnowledge`, `processOnboardingAnswers`, `processTranscriptIntelligence`) plus `processVenueDocument`, `sendBudgetQuote`, `generateVenueVisualization`, `createHighLevelLeadAndNotify` (head/tail + auth lines), `checkHighLevelConnection` (full), `invokeAnthropicGenerator` (constants + handler core), `getChatSessionPublic` (response contract), `listMissingDates` (head), all 20 entity RLS blocks + `User.jsonc` in full, request/response contract lines of all 28 functions, caller sweep of every function across `src/`, `vite.config.js`, package scripts, tests directory, git revision/branch/remote.
- **Authoritative platform references consulted:** RLS capability guide, backend-functions capability guide, googlecalendar connector info, docs on preview/published data & secret propagation, GitHub sync, Version History, CSV export.
- **Not accessible from this assistant (screenshots needed):** App Settings (visibility/test-data), Authentication (sign-in methods), Code → Functions (any per-function access toggles), Workflows/Agents dashboard sections, Settings → OAuth Connectors (callback URL). All labeled **[X]** inline.
- **Deliberately not done:** runtime invocation of any function; reading of customer records; exposure of secret values. All exploitability statements are source-confirmed / runtime-unverified.
- **Corrections issued to the previous report:** (1) `createUserInvite` permission-validation claim — **retracted**; (2) directory counts — corrected to 12/9/10/17; (3) "no deployment history" — corrected: Version History revert/publish exists; (4) partial reads previously listed as "fully inspected" — this pass separates full reads from contract-line reads.
- **Top-priority repairs (proposed, not implemented):** authz on the three ingestion functions + `clearSyncedDates`; authN/authz on `createUserInvite` and `getChatFeedback`; RLS for `VenueOperatingRules` (all four ops), `ChatSession.update`, `SavedBudgetEstimate.read`; verify the `{{user.venue_id}}` template form (7 entities); decide the fate of the 8 caller-less functions.

**Audit status: COMPLETE for all source-accessible scope; platform-dashboard items remain open pending the five screenshots listed above.**
