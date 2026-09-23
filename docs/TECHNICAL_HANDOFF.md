# My Virtual Planner (VenueIQ) — Technical Handoff Report

**Prepared:** 2026-09-22 · **Inspector:** Base44 development assistant · **Deliverable:** documentation only; no code, data, schemas, secrets, or deployment settings were modified.

**App identity**

- Internal project name: **VenueIQ** — `base44/config.jsonc` (`{"name": "VenueIQ", ...}`).
- Public product name / HTML title: **My Virtual Planner** — `index.html` (`<title>My Virtual Planner</title>`), logo at `public/my-virtual-planner-logo.png`, used by `src/components/marketing/LandingPage.jsx`.
- Published URL: `https://sugar-lake-weddings-virtual-planner-d6d4e1eb.base44.app`
- Git repository present in the workspace; **HEAD: `fdb858a` "Update base44 packages"** (most recent commit; prior commits are "External agent changes"). No branch listing beyond the default was inspected.

---

## Part A — Sections 1–5

---

### 1. Inspection rules and completeness

**What was inspected**

- The **editable project sandbox** (the live source tree the preview builds from): all of `src/`, `base44/`, `public/`, `tests/`, root manifests (`package.json`, `package-lock.json`, `vite.config.js`, `tailwind.config.js`, `eslint.config.js`, `jsconfig.json`, `index.html`), and `.git` history headlines. A `dist/` build-output folder exists but was not treated as source.
- **Not inspected / not accessible:** the Base44 dashboard (auth provider configuration, actual RLS engine behavior, secrets *values*, runtime logs, published-build runtime, app user records, deployment history, analytics), the live production database contents, and any deployed runtime state. The published app may differ from this working tree; the platform states there is no deployment-history view, so drift cannot be verified from here.
- Some entity schemas and backend functions cited below come from a compaction snapshot of this same project's earlier inspection; files re-read directly are marked. Where a claim comes only from the snapshot, it is labeled **(snapshot)**.

**Evidence tiers used throughout**

- **Verified** — read from source this session (path cited).
- **Snapshot-verified** — schema/summary carried from the prior compacted inspection of this same codebase; spot-checked where possible (e.g., `base44/entities/User.jsonc` re-read directly).
- **Configured, runtime-unverified** — code/config exists; behavior at runtime not observed.
- **Inference / Unknown** — explicitly labeled.

**Inventory inspected (complete file enumeration, verified via `find`)**

| Category | Count | Location |
|---|---|---|
| Pages | 13 `.jsx` | `src/pages/` (12 routed via `src/pages.config.js` + `OAuthConsent.jsx`, see §4) |
| Shared layout | 1 | `src/Layout.jsx` |
| Chat components | 13 | `src/components/chat/` |
| Flow components | 11 | `src/components/flows/` |
| Admin components | 16 | `src/components/admin/` |
| Dashboard components | 7 | `src/components/dashboard/` |
| FirstLook components | 3 + `src/components/FirstLook.jsx` | `src/components/firstlook/` |
| Hooks/helpers | 12 | `src/components/hooks/` |
| Marketing | 2 | `src/components/marketing/` |
| shadcn/ui primitives | 49 | `src/components/ui/` |
| Lib | 8 | `src/lib/` (+ `src/utils/index.ts`, `src/api/base44Client.js`, `src/hooks/use-mobile.jsx`) |
| Entity schemas | 20 | `base44/entities/*.jsonc` (19 app entities + `User.jsonc`) |
| Backend functions | 28 | `base44/functions/*/entry.ts` |
| Workflows | **0** | no `base44/workflows/` directory exists |
| Agents | **0** | no `base44/agents/` directory exists |
| Shared backend modules | **0** | no `base44/shared/` directory exists |
| Tests | 4 | `tests/*.mjs` (plain `node:`-based, see §3) |
| Static public assets | 4 | `public/my-virtual-planner-logo.png`, `public/pdf.worker-4.10.38.min.mjs`, `public/privacy-policy.html`, `public/terms-of-service.html` |
| App MCP config | **absent** | `src/pages/OAuthConsent.jsx` references `base44/mcp/config.json` in a comment, but no `base44/mcp/` exists in this sandbox — either platform-managed outside the tree or the file is not exported here (**unknown**) |

**Secrets (names only — values never read):** `ANTHROPIC_API_KEY`, `CLICKUP_API_TOKEN`, `CLICKUP_FEEDBACK_LIST_ID`, `CONRAD_HIGHLEVEL_API_KEY`, `CONRAD_HIGHLEVEL_LOCATION_ID`, `CONRAD_HIGHLEVEL_TOUR_CALENDAR_ID`, `HIGHLEVEL_API_KEY`, `HIGHLEVEL_LOCATION_ID`, `HIGHLEVEL_TOUR_CALENDAR_ID`, `HIGHLEVEL_WEDDING_CALENDAR_ID`, `STABILITY_API_KEY`, `SUGAR_LAKE_PLANNERS_EMAIL`.

**Custom code vs platform-managed behavior** — custom: everything in `src/` and `base44/functions/`, entity JSON schemas, `index.html`. Platform-managed (not editable here): authentication/session backend, entity storage + RLS enforcement engine, function runtime (Deno), hosting/deploys, connector OAuth token storage, email delivery via `Core.SendEmail`, file storage, integration credits. Claims below about runtime RLS enforcement are **configured-not-runtime-verified** (the `rls` blocks are declared in schema files; the enforcing engine is platform-side).

---

### 2. Product and architecture

**What it does.** A white-label, multi-tenant "virtual wedding planner" chatbot that wedding venues embed on their own websites (iframe) or link to. Couples (typically brides) chat anonymously; the bot answers from a per-venue knowledge base, checks real date availability, quotes pricing, schedules tours, captures leads, and escalates to a human planner via HighLevel (GoHighLevel) SMS. Venue owners manage knowledge, bookings, pricing, photos, and review conversations in an admin dashboard.

**Users and roles** (role values seen in code: `admin`, `venue_owner`, `venue_staff` — e.g., `src/pages/Home.jsx:123`):

- **Anonymous couple ("bride")** — the chatbot at `/` with `?venue=<slug>` or `?embed=1`; also the marketing landing page. No account.
- **Venue owner / staff** — dashboard pages after login; venue is pinned to their `user.venue_id` (`src/lib/VenueContext.jsx`: "A venue owner always resolves to their own venue").
- **Super admin** (`role === 'admin'`) — everything plus cross-venue selector in `src/Layout.jsx`, `/SuperAdmin` venue + user + invite management.
- **Platform-level distinction:** the app *owner* is also a Base44 workspace admin; that is dashboard-level, outside app code.

**Major subsystems**

1. **Bride-facing chatbot** — `src/pages/Home.jsx` (venue resolution, embed/iframe rules, localStorage transcript persistence), `src/components/hooks/useChatFlow.jsx` (1489-line orchestration hook), prompt builders in `src/components/hooks/buildClassifierPrompt.jsx` / `buildGeneratorPrompt.jsx`, inline flows (`src/components/flows/`).
2. **Lead capture & human handoff** — `HandoffContactCard.jsx` → backend `createHighLevelLeadAndNotify` → HighLevel contact upsert + SMS + note → `HandoffRequest` entity.
3. **Availability & calendars** — `BookedWeddingDate`/`BlockedDate` entities; Google Calendar sync (`syncGoogleCalendar` function + `GoogleCalendarSync.jsx`); anonymous date checks (`checkDateAvailability`).
4. **Knowledge management** — `VenueKnowledge` (topic-tagged Q&A), ingestion via `processOnboardingAnswers` (wizard), `processTranscriptIntelligence` (transcripts), `processVenueDocument` (PDF/docs), `generateAutoKnowledge` (from structured data); review UI in `src/pages/Planner.jsx`.
5. **Pricing & budget** — `WeddingPricingConfiguration` (full grid), `VenuePackage`, `EnhancedBudgetCalculator` flow, `sendBudgetQuote` (email/SMS via HighLevel), `SavedBudgetEstimate`, `ContactSubmission`.
6. **Tours** — `TourScheduler.jsx` → `getHighLevelAvailability` + `createHighLevelAppointment` (HighLevel calendar).
7. **Admin/ops** — Dashboard analytics, conversation review, feedback (with ClickUp escalation), venue settings, weddings CRUD, invite system.
8. **First Look video experience** — `FirstLookConfiguration`, `src/components/FirstLook.jsx`, Wistia video embeds in chat.
9. **Visualization** — `VenueVisualizer` + `generateVenueVisualization` (Stability AI inpainting) over `VenueVisualizationPhoto` + `VisualizerHeroImage`.
10. **Marketing landing page** — `LandingPage.jsx` + `landing.css`, shown at `/` when no venue param, not embedded, and not logged in (`Home.jsx:39-44`).

**How the frontend, backend, entities, auth, storage, AI, and external services connect**

```
                    ┌────────────────────────────────────────────┐
                    │  Browser (React 18 + Vite SPA)             │
                    │  /            Home.jsx (chatbot|landing)   │
                    │  /Dashboard …  Layout.jsx shell (staff)    │
                    │  pre-init SDK: src/api/base44Client.js     │
                    └───────┬──────────────────────┬──────────────┘
                            │ SDK (entities/auth/  │ SDK functions.invoke
                            │ integrations)        │
                    ┌───────▼──────────────┐  ┌────▼─────────────────────┐
                    │ Base44 platform      │  │ Backend functions        │
                    │ • Auth (sessions,    │  │ (Deno, base44/functions/ │
                    │   login page, users) │  │  <name>/entry.ts)        │
                    │ • Entity store + RLS│  │ • service-role SDK use   │
                    │ • File storage       │  │ • secrets (env names)    │
                    │ • Core integrations  │  └──┬───────┬───────┬───────┘
                    └──────────┬───────────┘     │       │       │
                               │ InvokeLLM       │       │       │
                        ┌──────▼──────┐   ┌──────▼───┐ ┌─▼──────┐ ┌▼──────────┐
                        │ Base44 AI   │   │ Anthropic│ │HighLevel│ │ Stability │
                        │ (classifier:│   │ (generator│ │(2 sub-  │ │ (venue    │
                        │ gemini_3_   │   │ claude-   │ │accounts │ │ visuali-  │
                        │ flash)      │   │ sonnet-5) │ │by ID)   │ │ zation)   │
                        └─────────────┘   └──────────┘ └─────────┘ └───────────┘
                                         Google Calendar (OAuth connector, per-venue
                                         app-user token) · ClickUp · SendEmail
```

**Venue identity & data separation.** A venue is identified publicly by `Venue.slug` (`?venue=<slug>` required — `Home.jsx:84-105` deliberately has no single-venue fallback) and internally by `venue_id` on nearly every record. Staff-side separation relies on (a) `user.venue_id` on the user record (the only custom field on `User.jsonc`, and it is `required` there), resolved in `VenueContext.jsx` (`venueId = user?.venue_id || (isAdmin ? selectedVenueId : null)`), (b) RLS rules referencing `{{user.data.venue_id}}` in entity schemas, and (c) explicit venue checks inside backend functions (e.g., `syncGoogleCalendar/entry.ts:65`, `getChatSessionPublic` returns 404 for cross-venue access, `createHighLevelLeadAndNotify` validates `chatSession.venue_id === venueId`). **This is conventional/declared isolation, not enforced foreign keys** — see §9 for gaps.

**Preview vs published vs export.** Same codebase serves the Vite preview and the published build (`npm run build` → `dist/`, per `base44/config.jsonc`). Behavior differences: preview hosts vs production domain have historically caused invite-link bugs (project memory: invite links now use a hardcoded production URL in `createUserInvite`); iframe embeds are detected via `window.self !== window.top || params.get('embed') === '1'` (`Home.jsx:38`). There is no repo export/CI in evidence beyond git; `.gitignore` and `README.md` exist. **Unknown:** whether any external repo sync is connected.

**End-to-end request example (traced in code, all paths verified):**

1. Bride types "Is October 10 2028 open?" in the embed → `ChatInput` → `useChatFlow.handleUserMessage` (`useChatFlow.jsx:285`).
2. `ensureChatSession` creates a `ChatSession` (anonymous create allowed by RLS `create: null`).
3. **STEP 1** classifier: `base44.integrations.Core.InvokeLLM` with `CLASSIFIER_SCHEMA`, model `gemini_3_flash` (`useChatFlow.jsx:362-378`) → intent `date_inquiry`, parsed date.
4. **STEP 2** availability: `base44.functions.invoke('checkDateAvailability', ...)` (`useChatFlow.jsx:764/894/964/1078`) — anonymous function, service-role read of `BookedWeddingDate`+`BlockedDate`, returns `isAvailable` + alternatives; verdict sentence composed deterministically in code (`composeAvailabilityReply.js`).
5. **STEP 3** generator: `buildGeneratorPrompt` assembles knowledge (topic-filtered `VenueKnowledge`), known-bride block, availability verdict → `base44.functions.invoke('invokeAnthropicGenerator')` → Anthropic `claude-sonnet-5` forced `tool_use` (`{needsHandoff, topicSummary, answer}`).
6. Message rendered; transcript synced to `ChatSession` (debounced 2s) and to `localStorage` (`viq_chat_v1_<slug>`, 24h TTL — `Home.jsx:206-267`).

---

### 3. Technology stack and project structure

**Frontend (verified from `package.json` + lockfile)**

- React `^18.2.0` (**resolved 18.3.1**), react-router-dom `^6.26.0`, Vite `^6.1.0`, `@vitejs/plugin-react`, Tailwind CSS `^3.4.17` + `tailwindcss-animate`, shadcn/ui pattern (49 hand-vendored components in `src/components/ui/` over Radix primitives), lucide-react `^0.475.0`, TanStack Query `^5.84.1`, react-hook-form `^7.54.2` + zod `^3.24.2` (+ `@hookform/resolvers`), date-fns `^3.6.0` + moment, lodash, framer-motion, recharts, pdfjs-dist **pinned `4.10.38`** (worker mirrored at `public/pdf.worker-4.10.38.min.mjs`), jspdf, html2canvas, react-leaflet, three, embla/carousel, sonner + shadcn toaster (both present), react-markdown + remark-gfm, `@hello-pangea/dnd`, `@stripe/*` (present in manifest; **no Stripe usage found in `src/` or functions — likely unused dependency**).
- `@base44/sdk ^0.8.49` (**resolved 0.8.49**) + `@base44/vite-plugin ^1.0.42` — platform-required.

**Backend functions runtime:** Deno (`Deno.serve` in every `entry.ts`), importing `npm:@base44/sdk` at **inconsistently pinned versions** across functions: `0.8.31` (syncGoogleCalendar), `0.8.6` (invokeAnthropicGenerator), `0.8.25` (getChatSessionPublic) — each file's own import is verified; the mixed pinning is itself a maintenance finding.

**Data & services:** entity storage/RLS/auth/file upload/email via Base44 SDK; AI: Base44 `Core.InvokeLLM` (classifier), Anthropic Messages API direct (generator), Stability AI (visualization), HighLevel REST (contacts/appointments/SMS/calendars), ClickUp API (feedback tasks), Google Calendar API v3 via connector token, Wistia video embeds (chat video messages).

**Tooling:** npm (no pnpm/yarn lockfile), scripts: `dev`, `build`, `preview`, `lint` (flat ESLint 9 + react/react-hooks/unused-imports plugins), `typecheck` (`tsc -p jsconfig.json`, `jsconfig.json` provides the `@/` alias). **No test script in `package.json`** — tests are 4 standalone `node tests/*.mjs` scripts (`handoff-session`, `booking-ranges`, `availability-reply`, `highlevel-routing`) that read source files and run them in `node:vm` with stubbed dependencies (verified by reading `tests/handoff-session.test.mjs`).

**Secrets inventory (names, consumer, purpose)**

| Secret | Consumer(s) | Purpose | Required? |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | `invokeAnthropicGenerator` | Chat generator LLM | Yes — 500s without it |
| `HIGHLEVEL_API_KEY` / `_LOCATION_ID` / `_TOUR_CALENDAR_ID` | `sendBudgetQuote`, `getHighLevelWeddingDates`, `listMissingDates`, `debugAvailability`, and (unprefixed path of) `highLevelConfig()` in contact/appointment/lead/availability/connection functions | Sugar Lake subaccount | Yes for Sugar Lake features |
| `CONRAD_HIGHLEVEL_*` (3) | same `highLevelConfig()` routing | Conrad venue subaccount | Yes for Conrad features |
| `HIGHLEVEL_WEDDING_CALENDAR_ID` | `getHighLevelWeddingDates`, `listMissingDates`, `debugAvailability` | Wedding-date pulls | Yes for those admin tools |
| `CLICKUP_API_TOKEN`, `CLICKUP_FEEDBACK_LIST_ID` | `createClickUpTask` | Thumbs-down feedback tasks | Optional (feature degrades) |
| `STABILITY_API_KEY` | `generateVenueVisualization` | AI venue photos | Optional (feature degrades) |
| `SUGAR_LAKE_PLANNERS_EMAIL` | (project memory: used in invite/quote copy) | Recipient address | Verify before relying |

**What requires replacement outside Base44:** auth/session, entity store + RLS engine, function runtime/hosting, `Core.*` (SendEmail, UploadFile, InvokeLLM), connector token management, the invite-email send path.

**Project tree (responsibilities)**

```
├── index.html                # title, favicon ref, SEO verification meta, root div
├── base44/
│   ├── config.jsonc          # project name "VenueIQ", build/dev commands, output ./dist
│   ├── entities/*.jsonc      # 20 entity schemas + rls blocks (the DB contract)
│   └── functions/<name>/entry.ts   # 28 Deno HTTP handlers
├── public/                   # static: logo, pdf worker, privacy-policy.html, terms-of-service.html
├── src/
│   ├── App.jsx               # routes: "/" + pagesConfig loop + 404 (see §4 caveat)
│   ├── pages.config.js       # AUTO-GENERATED page registry; 12 pages; mainPage: "Home"
│   ├── Layout.jsx            # staff shell (allow-list SHELL_PAGES, venue selector, nav)
│   ├── pages/                # 13 page components
│   ├── components/
│   │   ├── chat/             # message rendering, input, handoff card, feedback, debug
│   │   ├── flows/            # in-chat widgets: budget, availability, tour, packages, gallery, visualizer
│   │   ├── admin/            # staff tools: calendar sync, onboarding wizard, uploads, pricing, photos
│   │   ├── dashboard/        # analytics widgets, benchmarks, readiness
│   │   ├── firstlook/ + FirstLook.jsx   # Wistia-hosted video welcome experience
│   │   ├── hooks/            # useChatFlow (orchestrator) + prompt builders + date parsers + handoff logic
│   │   ├── marketing/        # public landing page + CSS
│   │   └── ui/               # shadcn primitives (vendored)
│   ├── lib/                  # AuthContext, VenueContext, app-params, bookingDates, query-client, NavigationTracker, PageNotFound
│   ├── api/base44Client.js   # pre-initialized SDK client
│   └── utils/index.ts        # createPageUrl, cn, etc.
└── tests/                    # 4 node-vm source-level tests
```

---

### 4. Feature, route, and UI map

**Routing facts (verified in `src/App.jsx` + `src/pages.config.js`):** routes are `/` → `Home` (mainPage), then a loop over `PAGES` (`/AdminCalendar`, `/AdminChatSessions`, `/ChatTranscript`, `/AdminWeddings`, `/Dashboard`, `/Feedback`, `/Home`, `/Invite`, `/Planner`, `/Register`, `/SuperAdmin`, `/VenueSettings`), then `*` → `PageNotFound`. Each routed page is wrapped by `LayoutWrapper` (`src/Layout.jsx`), which renders the staff shell **only** for its `SHELL_PAGES` allow-list (`Dashboard, AdminChatSessions, ChatTranscript, Planner, AdminCalendar, AdminWeddings, VenueSettings, Feedback, SuperAdmin`); all other routes render bare (so the chatbot, auth pages, and invite pages never show staff nav).

- ⚠️ **`src/pages/OAuthConsent.jsx` is NOT in `pages.config.js` and has no explicit `<Route>` in `App.jsx`** — under the current routing table it appears **unreachable**, even though the app-side MCP consent flow expects it (its own comment says the platform redirects there via `base44/mcp/config.json`, which is not in this sandbox). **Configured, reachability unknown/unverified.**

**Per-page detail** (access enforcement is via RLS + in-page checks; no auth-route wrapper exists — `Home.jsx` itself redirects logged-in staff to Dashboard, lines 110–143):

| Route | File | Purpose & notes | Enforcement | Backend / entities | Status |
|---|---|---|---|---|---|
| `/` | `pages/Home.jsx` | Landing (anonymous, no params) or venue chatbot (`?venue=slug`, `?embed=1`, `?message=`, `?debug=1`); admin gets `VenuePickerScreen` on bare URL; localStorage transcript (24h TTL) | Public; staff redirected to `/Dashboard` | `Venue.list/get`, `BookedWeddingDate.list()` (⚠️ unscoped), `VenueKnowledge.filter`, `FirstLookConfiguration.filter`, `ChatSession.create/update`, functions `checkDateAvailability`, `invokeAnthropicGenerator`, `createHighLevelLeadAndNotify`, `createClickUpTask`; Core.InvokeLLM | Active; embed rules deliberately iframe-safe (no window scroll, no autofocus — enforced in `useChatFlow`) |
| `/Dashboard` | `pages/Dashboard.jsx` | Venue KPIs: bookings, sessions, analytics; readiness | Staff (RLS-scoped queries) | `BookedWeddingDate.filter`, `getBenchmarkingData`, dashboard widgets | Active |
| `/AdminChatSessions` | `pages/AdminChatSessions.jsx` | Conversation list (1000 latest) | Staff; RLS read `venue_id` or admin | `ChatSession.filter({venue_id})` | Active; known issue: RLS `update: null` (see §9) |
| `/ChatTranscript` | `pages/ChatTranscript.jsx` | Single transcript + sibling sessions | Function-level check (404 on cross-venue) | `getChatSessionPublic`, `ChatSession.filter` | Active |
| `/Planner` | `pages/Planner.jsx` | Knowledge base CRUD + review/approve drafts; handoff tuning | Staff; entity RLS | `VenueKnowledge` full CRUD, `processOnboardingAnswers`/`processTranscriptIntelligence` via uploads | Active |
| `/AdminCalendar` | `pages/AdminCalendar.jsx` | Booked/blocked dates, clear-sync tool | Staff | `BookedWeddingDate`, `BlockedDate`, `clearSyncedDates` | Active |
| `/AdminWeddings` | `pages/AdminWeddings.jsx` | Wedding bookings CRUD ( WeddingForm) | Staff | `BookedWeddingDate` | Active |
| `/VenueSettings` | `pages/VenueSettings.jsx` | Venue profile, planner names, Google Calendar sync, HighLevel check, photos, First Look, pricing | Staff | `Venue.update`, `generateAutoKnowledge`, `syncGoogleCalendar`, `checkHighLevelConnection`, etc. | Active |
| `/Feedback` | `pages/Feedback.jsx` | Thumbs feedback review | Staff | `ChatFeedback.list()`, `getChatFeedback` | Active; platform RLS bug workaround in place (see §7) |
| `/SuperAdmin` | `pages/SuperAdmin.jsx` | Venues + users + invites (email delivery status shown) | Admin-only content; relies on RLS + user checks | `Venue.create/list`, `User.list`, `createUserInvite` | Active; no venue-delete/role UI (known gap) |
| `/Invite` | `pages/Invite.jsx` | Accept invite, set password, redirect to Dashboard | Token-gated | `validateUserInvite`, `acceptUserInvite` | Active |
| `/Register` | `pages/Register.jsx` | Multi-step registration (auth.register → verifyOtp → loginViaEmailPassword) | Public + invite token | `validateUserInvite` | Active |
| `/OAuthConsent` | `pages/OAuthConsent.jsx` | MCP consent approve/deny UI | Session-gated; fetches `/api/apps/<id>/mcp/consent-info` | platform MCP endpoints | **Possibly unrouted — see above** |
| *(no route)* | `components/marketing/LandingPage.jsx` | Public marketing page | Public | none (auth redirect on sign-in) | Active |
| *(no route)* | `components/UserNotRegisteredError.jsx`, `AuthLayout.jsx` | Auth error shell | platform | — | Active |

**Feature → route/component → backend function → entities → integration map**

| Feature | Entry | Function(s) | Entities | Integration |
|---|---|---|---|---|
| Chat reply pipeline | Home → useChatFlow | `invokeAnthropicGenerator`, `checkDateAvailability` | ChatSession, VenueKnowledge, Venue, BookedWeddingDate (via fn) | Anthropic, Base44 InvokeLLM (classifier) |
| Human handoff ("text me") | HandoffContactCard | `createHighLevelLeadAndNotify` | HandoffRequest, ChatSession, ContactSubmission (implied) | HighLevel (contact upsert, SMS, note) |
| Date availability | AvailabilityChecker + in-chat | `checkDateAvailability` | BookedWeddingDate, BlockedDate | — |
| Tour scheduling | TourScheduler | `getHighLevelAvailability`, `createHighLevelAppointment`, `createHighLevelContact` | ContactSubmission | HighLevel calendars |
| Budget quote | EnhancedBudgetCalculator / SendBudgetForm | `sendBudgetQuote` | SavedBudgetEstimate, ContactSubmission, WeddingPricingConfiguration, VenuePackage (read) | HighLevel (contact/SMS/email) |
| Google Calendar sync | VenueSettings → GoogleCalendarSync | `syncGoogleCalendar` | Venue (google_calendar_id), BookedWeddingDate, CalendarSyncEvent | Google Calendar OAuth connector |
| Knowledge ingestion (3 paths) | VenueOnboardingWizard / TranscriptUpload / VenueDocumentUpload | `processOnboardingAnswers` / `processTranscriptIntelligence` / `processVenueDocument`; `generateAutoKnowledge` | VenueKnowledge (drafts), VenueOnboardingProgress | InvokeLLM; UploadFile; pdfjs client-side |
| Pricing admin | PricingManager (+ `initializeSugarLakePricing`, `updateVenueBasePricing` for Sugar Lake seeds) | — | WeddingPricingConfiguration | — |
| Feedback loop | MessageFeedback | `createChatFeedback` (verify workaround), `getChatFeedback`, `createClickUpTask` | ChatFeedback | ClickUp |
| Invites | SuperAdmin → Invite/Register | `createUserInvite`, `validateUserInvite`, `acceptUserInvite` | UserInvite, User, Venue | SendEmail |
| Visualizer | VenueVisualizer | `generateVenueVisualization` | VenueVisualizationPhoto, VisualizerHeroImage | Stability AI |
| Gallery | VenueGallery | — | VenuePhoto | — |
| First Look | Home chat video messages / VenueSettings | — | FirstLookConfiguration | Wistia |
| Diagnostics | Admin tools / `?debug=1` | `debugAvailability`, `listMissingDates`, `getHighLevelWeddingDates`, `clearSyncedDates` | BookedWeddingDate | HighLevel |
| Benchmarks | Dashboard → IndustryBenchmarks | `getBenchmarkingData` | BookedWeddingDate, VenuePackage, ContactSubmission | — |

**Unused / duplicated UI:** `BudgetCalculator.jsx` (legacy, superseded by `EnhancedBudgetCalculator` — both exist in `src/components/flows/`), `VenueSelector.jsx` (admin) vs Layout's inline selector (a checkpoint notes "remove duplicate venue selectors" was completed — file still present; treat as possibly vestigial, unverified usage), `PlannerTestChat.jsx` (test harness). `sonner` and shadcn toaster both wired (`App.jsx` Toaster + `Home.jsx` sonner `<Toaster>`).

---

### 5. Complete function and API inventory

All 28 are Deno HTTP handlers at `base44/functions/<name>/entry.ts`, invoked from the browser via `base44.functions.invoke('<name>', payload)` (never absolute URLs in app code). "Auth" column = server-side check verified in source. `asServiceRole` = bypasses RLS.

| Function | Purpose / trigger | Auth (verified) | Key entities & side effects | Notes |
|---|---|---|---|---|
| `invokeAnthropicGenerator` | STEP-3 chat generator; called by `useChatFlow.jsx:1225` | **None** (anonymous by design) | none; 60s AbortController timeout, max_tokens 2000, forced `reply` tool; logs token usage | Direct Anthropic API, bypasses integration credits |
| `checkDateAvailability` | Anonymous availability + monthOpenings + alternatives; chat + AvailabilityChecker | **None** (documented intent) | reads BookedWeddingDate/BlockedDate via service role, venue-filtered; no PII returned | PII-safe by construction (comment verified against code) |
| `createHighLevelLeadAndNotify` | Handoff: upsert lead, tags, note, intro SMS; called by HandoffContactCard | **None visible** — validates session belongs to venue (`entry.ts:26`) | creates HandoffRequest (also on failures), updates ChatSession (handoff flags) | Per-venue credentials via hardcoded ID map (§9); SMS failure ≠ lead failure (card UI distinguishes) |
| `createHighLevelContact` | Contact upsert for tours; TourScheduler path | **None visible** | creates ContactSubmission | `highLevelConfig` prefix map at `entry.ts:116-128` |
| `createHighLevelAppointment` | Book tour slot in HighLevel | **None visible** | reads Venue (service role) | checks calendar active/same-account before booking |
| `getHighLevelAvailability` | Tour slots for a date range | **None visible** | reads Venue | same credential routing |
| `checkHighLevelConnection` | Dashboard connection status | **Yes** — `auth.me`, venue match (`entry.ts:6-9`) | — | returns configured/not-configured status |
| `sendBudgetQuote` | Deliver budget estimate via SMS/email; budget calculator | **None visible** | HighLevel contact upsert; reads config | uses unprefixed (Sugar Lake) secrets — **single-venue assumption** |
| `syncGoogleCalendar` | `list_calendars` / `sync_calendar` (3-year window, 50-page cap); called by GoogleCalendarSync | **Yes** — auth + venue ownership (`entry.ts:59-67`) | updates Venue.google_calendar_id; creates/updates/merges BookedWeddingDate (dedupe by google_event_id, archive via merged_into_id); CalendarSyncEvent audit | Uses app-user Google connector token (id `6a2b72d0b1ae3cefb36ece05`); timezone-aware multi-day events |
| `clearSyncedDates` | Delete all BookedWeddingDate for a venue | **Yes** (`auth.me`, 401) — **venue ownership check not observed in inspected lines** | deletes BookedWeddingDate (service role) | ⚠️ potential cross-venue delete; partially inspected |
| `createUserInvite` | Invite user to venue; SuperAdmin | Partially inspected (snapshot: permission validation) | expiring UserInvite token, SendEmail (HTML template, hardcoded production URL) | duplicate pending invites expired; existing users rejected |
| `validateUserInvite` | Token → invite info; Invite/Register | token-gated | reads UserInvite, Venue | — |
| `acceptUserInvite` | Accept: link existing user or create user with venue_id + role | token-gated | creates/updates **User** records (service role) | role comes from invite record (venue_owner/venue_staff) |
| `createChatFeedback` | Persist feedback (server-side workaround for anonymous create bug) | None | ChatFeedback create via service role, then `get` verify; 500 if not persisted | — |
| `getChatFeedback` | List feedback; Feedback page | **⚠️ No auth check observed** (`entry.ts:5-17`) | service-role read of ALL ChatFeedback, filtered in memory | includes transcripts + debug traces — see §9 |
| `createClickUpTask` | ClickUp task on thumbs-down; fire-and-forget from useChatFlow | None | none (ClickUp API) | known issue: 500s from anonymous context (project memory) |
| `processOnboardingAnswers` | Wizard answers → draft knowledge | Yes (snapshot-verified) | VenueKnowledge (inactive, needs_review), VenueOnboardingProgress | non-destructive draft insertion; hallucination scan |
| `processTranscriptIntelligence` | Transcript → draft knowledge (6 categories) | Yes (snapshot-verified) | VenueKnowledge drafts | Jaccard dedupe |
| `processVenueDocument` | PDF/doc ingestion with page-batched LLM extraction | Yes (snapshot-verified) | VenueKnowledge drafts w/ source_page, excerpt, confidence | rejects oversized docs; requires evidence |
| `generateAutoKnowledge` | Auto FAQ drafts from structured venue data | Yes (snapshot-verified) | VenueKnowledge drafts, VenueOnboardingProgress | non-destructive |
| `initializeSugarLakePricing` | Seed/replace Sugar Lake pricing grid | **Yes** — admin (`entry.ts:6-9`) | WeddingPricingConfiguration upsert | venue-specific seeding |
| `updateVenueBasePricing` | Update a pricing config | **Yes** — admin (`entry.ts:6-9`) | WeddingPricingConfiguration | — |
| `getBenchmarkingData` | Cross-venue benchmarks for dashboard | **Yes** (`auth.me`, 401) | reads BookedWeddingDate, VenuePackage, ContactSubmission (service role) | aggregates only |
| `getChatSessionPublic` | Transcript view | **Yes** + venue match (404) | ChatSession, Venue | minimal field projection |
| `getHighLevelWeddingDates` | Pull booked dates from HighLevel (admin) | ⚠️ not observed in inspected lines | — | Sugar Lake secrets |
| `listMissingDates` | Diff HighLevel vs local bookings | ⚠️ not observed | reads via HighLevel | Sugar Lake secrets |
| `debugAvailability` | Availability diagnostics | ⚠️ not observed | — | Sugar Lake secrets |
| `generateVenueVisualization` | Stability AI masked/unmasked generation; VenueVisualizer | None visible (snapshot-verified flow) | none | resizes to SDXL dims |

**Frontend→backend mapping** is one-to-one through `base44.functions.invoke(...)` calls listed in the §4 table; **no webhook triggers, schedules, or agents exist** — every function is UI-invoked (or invoked by the feedback path inside `useChatFlow`). **Unreachable/suspect functions:** `initializeSugarLakePricing` and `updateVenueBasePricing` have no current UI caller found in the grep sweep (they were used for one-time seeding — verify before deletion); `debugAvailability`/`listMissingDates` are diagnostic (callers: admin tooling, unverified). Named custom hooks/helpers: `useChatFlow` (parent of dozens of internal callbacks — session sync, handoff staging, date parsing, month pagination, verdict composition), `handoffIntent.isDirectPlannerRequest`, `composeAvailabilityReply`, `parseDateFromText`/`parseDatesFromText`/`parseMonthsFromText`, `dateHelpers`, `flowCompletionHandlers`, `bookingDates.js`, `prepareVenuePdf.js` (client-side PDF downscale before upload).

---

## Part B — Sections 6–10

---

### 6. Complete database/entity reference

**Source of truth:** `base44/entities/<Name>.jsonc` — each file is the complete logical schema **plus** an `rls` block; it *replaces* the stored schema on write. Every record has platform-managed `id`, `created_date`, `updated_date`, `created_by_id`. **The physical engine (MongoDB-like update operators are accepted by `updateMany`, e.g. `$set`/`$push`) is platform-managed; no physical schema, indexes, or constraint enforcement are visible from here — all "relationships" below are conventional (unenforced IDs), not foreign keys.** Uniqueness: no unique indexes are declarable in these files; `UserInvite.token`, `Venue.slug`, `BookedWeddingDate.google_event_id` uniqueness is enforced **only by application logic**.

RLS legend: `null` = **no restriction** (any authenticated caller, or anonymous where the operation is public); `data.venue_id: "{{user.data.venue_id}}"` = record-scoped; `user_condition role=admin` = admin-only.

| Entity | Key fields (type/required) | RLS create / read / update / delete | Read/written by |
|---|---|---|---|
| **Venue** | name*; slug; domain; timezone (default America/New_York); head_planner_name (**no default, deliberately**); planner_name/planner_title (default "our planner"); google_calendar_id; availability_data_verified (bool, default false — gates availability answers) | admin / **null (open read)** / owner-or-admin / admin | Home, VenueContext, VenueSettings, SuperAdmin, sync fn, most backend fns (service role) |
| **User** (platform) | venue_id (string, **required** in schema) | platform-managed; admins only list/update others | SuperAdmin (list), acceptUserInvite (create/update, service role) |
| **UserInvite** | email*, venue_id*, role* (`venue_owner\|venue_staff`), token*, status (pending/accepted/expired), expires_at, accepted_at | admin×4 | invite fns, SuperAdmin |
| **ChatSession** | venue_id*; lead_name/phone/email/wedding_date/guest_count/budget_range; messages[] {role bot/user, content, timestamp}; flows_completed[]; flow_results{}; handoff_offered/accepted/triggered; handoff_topic; status (active/handed_off/abandoned/completed) | **null** / venue-or-admin / **null** / venue-or-admin | useChatFlow (create/update), AdminChatSessions, ChatTranscript, handoff fn |
| **VenueKnowledge** | venue_id*, question*, answer*; category (16 enum); topic (18 enum); is_active; priority; tags[]; source (manual/transcript/imported); confidence; needs_review; source_excerpt; source_page | venue-or-admin / **null** / venue-or-admin / venue-or-admin | chat retrieval, Planner, ingestion fns |
| **VenueOnboardingProgress** | venue_id*; topic_answers{}; topic_status{}; legacy section_*/answers_* fields; knowledge_generated_at; knowledge_count | venue-scoped ×4 | wizard, ingestion fns |
| **VenueOperatingRules** | venue_id*, months[12] (pricing_season, full_weddings, max guests, micro/elopement days), blocked_holidays[] (fixed or nth-weekday), tent_months, notes, is_active | **no rls block in schema file** (snapshot) — platform default applies | rule-based availability logic (note: schema exists; whether the chatbot's deterministic date path consumes it is **partially verified** — known issue lists missing seasonal filters) |
| **VenuePackage** | venue_id*, name*, price*, max_guests*, includes[], sort_order, is_active | venue / null / venue / venue (note: uses `{{user.venue_id}}` template, unlike most siblings' `{{user.data.venue_id}}` — a formatting inconsistency worth verifying against the RLS engine) | PackagesView, pricing fns, benchmarks |
| **WeddingPricingConfiguration** | venue_id*, pricing_data{} (large nested grid: venue_base tiers×day×season, catering/spirits/planning/photo/florals/decor/entertainment/linens/tableware/desserts per tier) | venue / null / venue / venue | EnhancedBudgetCalculator, PricingManager, seed/update fns |
| **BookedWeddingDate** | venue_id*, date*, end_date, couple_name, email, phone, guest_count, package, notes, deposit_paid, google_event_id, google_calendar_id, merged_into_id (archive marker) | venue-or-admin ×4 | sync fn, admin pages, availability fn (service role) |
| **BlockedDate** | venue_id*, date*, reason | venue-scoped ×4 | BlockDateForm, AdminCalendar, availability fn |
| **CalendarSyncEvent** | venue_id?, action (list_calendars/sync_calendar), status (connected/not_connected/error), error_message, user_id | **null** / venue-or-admin / admin / admin | sync fn (audit trail) |
| **HandoffRequest** | venue_id*, chat_session_id*, lead_name*, lead_phone*, topic_summary*, original_question*, ghl_* ids, transcript_url, status (pending/intro_sent/intro_failed/completed), error_message | venue-scoped ×4 | createHighLevelLeadAndNotify |
| **ContactSubmission** | venue_id*, name*, email*, phone, wedding_date, guest_count, tour_date/time, budget, priorities[], recommended_package, notes, source (budget_calculator/tour_scheduler/availability_check/chat), status (new→booked/lost) | **null** create / venue read / venue / venue | tour, budget, contact fns |
| **SavedBudgetEstimate** | venue_id*, name*, delivery_preference* (text/email), total_budget*, guest_count*, guest_tier*, day_of_week*, season*, budget_selections{}, budget_breakdown{}, highlevel_contact_id, highlevel_sync_status | **null** create / **null** read / venue / venue | EnhancedBudgetCalculator, sendBudgetQuote |
| **ChatFeedback** | rating (up/down), comment, flagged_message, preceding_user_message, transcript **object**, debug_trace **object**, chat_session_id, venue_id | **null** create / admin-or-venue / admin-or-venue / admin-or-venue | MessageFeedback→createChatFeedback, Feedback, getChatFeedback |
| **VenuePhoto** | venue_id*, category* (6 enum), image_url*, caption, alt_text, sort_order, is_featured, is_active | venue / null / venue / venue | VenueGallery, FeaturedPhotosManager (uploads via Core.UploadFile) |
| **VenueVisualizationPhoto** | venue_id*, name*, category*, photo_url*, mask_url, transformation_hints, aspect_ratio, photo_description | venue / null / venue / venue | VenueVisualizer, generateVenueVisualization |
| **VisualizerHeroImage** | category* (vibe/density/colors/season), option_id*, image_url*, label*, prompt*, colors[], is_active | admin / null / admin / admin | VenueVisualizer |
| **FirstLookConfiguration** | venue_id*, is_enabled, welcome_video_id (Wistia), host_name/title, welcome_text, video_options[] | venue / null / venue / venue | Home chat video messages, FirstLookSettings |

**ERD (logical; all arrows are conventional references, not enforced FKs):**

```
Venue 1──* VenueKnowledge, VenuePackage, WeddingPricingConfiguration,
          BookedWeddingDate, BlockedDate, VenuePhoto, VenueVisualizationPhoto,
          FirstLookConfiguration, VenueOnboardingProgress, VenueOperatingRules
Venue 1──* ChatSession 1──* ChatFeedback (chat_session_id)
                        1──* HandoffRequest (chat_session_id)
Venue 1──* UserInvite ──(accept)──> User.venue_id, User.role
Venue 1──* ContactSubmission, SavedBudgetEstimate, CalendarSyncEvent
BookedWeddingDate ──merged_into_id──> BookedWeddingDate (self-archive)
```

**Duplicated / competing sources of truth (flagged):** (1) booked dates exist in three places — `BookedWeddingDate` (local truth), Google Calendar events (sync source), and HighLevel wedding calendar (pull-only via `getHighLevelWeddingDates`/`listMissingDates`); `debugAvailability`/`listMissingDates` exist precisely because these drift. (2) Pricing lives in both `VenuePackage` (tier list shown in chat) and `WeddingPricingConfiguration` (calculator grid) — no code-level guarantee they agree. (3) `Venue.domain` vs hardcoded production URL for invite links. (4) `ChatSession.lead_*` fields vs `HandoffRequest.lead_*` (copied at handoff). (5) `VenueOperatingRules` vs the deterministic availability logic in `useChatFlow`/`checkDateAvailability` (known issue: seasonal filters not fully applied).

**Lifecycle/retention:** no deletion/TTL logic found for ChatSession, ChatFeedback, CalendarSyncEvent — unbounded growth is a real ops concern (inference from absence). `merged_into_id` is the only archiving mechanism observed. Client-side transcripts expire after 24h in localStorage (`Home.jsx:30`). **Sensitive-data categories present (by schema, no records read):** couples' names/phones/emails, lead budgets and wedding dates, chat transcripts (with debug traces in ChatFeedback), venue planner names. Seed data: `initializeSugarLakePricing` is the only seeding function (Sugar Lake); schema migration history is not accessible beyond git.

---

### 7. Business workflow traces

**7.1 Venue creation & onboarding.** `SuperAdmin` → `Venue.create` (RLS: admin only) → invite owner (`createUserInvite`: 7-day token, HTML email via `Core.SendEmail`, hardcoded prod URL, email status surfaced in UI). Owner logs in via `/Invite` (accept → `acceptUserInvite` links/creates User with venue_id). Onboarding: `VenueOnboardingWizard` collects topic answers → `processOnboardingAnswers` generates inactive `needs_review` drafts (non-destructive — a hard-delete variant was rolled back per project memory) → `VenueOnboardingProgress.topic_status` updated → owner approves in `/Planner` (`needs_review: false, is_active: true`). Failure paths: email failure is non-fatal (invite still created); duplicate pending invites are expired; already-registered users are rejected. A known past failure ("Assign User" button didn't set venue_id) led to the invite-token flow being the only supported assignment path.

**7.2 Document/PDF ingestion.** `VenueDocumentUpload.jsx` → `prepareVenuePdf.js` (client-side pdfjs re-render/downscale; worker at `public/pdf.worker-4.10.38.min.mjs`) → `Core.UploadFile` → `processVenueDocument` (auth + venue access; rejects oversized/unreadable docs; page-batched extraction requiring `source_page`, excerpt, confidence; dedupe against existing questions; drafts saved inactive). **Partially inspected** (summary + signature greps); page-batch chunking verified in function. Failure recovery: per-batch invalid-fact filtering; parser errors never become knowledge entries. **Open checkpoint in project memory: oversized-PDF onboarding.**

**7.3 Transcript ingestion.** `TranscriptUpload` → `processTranscriptIntelligence` (6 category prompts, Jaccard dedupe, drafts). Verified same pattern as 7.2.

**7.4 Packages/pricing/operating rules/budget.** Packages managed in Planner/`VenuePackage`; pricing grid via `PricingManager` (+ one-time `initializeSugarLakePricing`); rules via `VenueOperatingRules` (dashboard-managed, path unverified in this pass). Budget: `EnhancedBudgetCalculator` reads `WeddingPricingConfiguration` → builds estimate → `SavedBudgetEstimate.create` + `ContactSubmission.create` → `sendBudgetQuote` (HighLevel contact + SMS/email delivery; delivery preference enforced). Failure: quote send errors surface to the user in `SendBudgetForm`.

**7.5 Public chat, sessions, feedback, handoff.** Traced end-to-end in §2. Feedback: `MessageFeedback` → `submitMessageFeedback` (client) → `ChatFeedback.create` direct (workaround for the anonymous-create platform bug: records created from frontend can vanish; `createChatFeedback` backend verifies persistence with a `get` and 500s otherwise) → thumbs-down also fires `createClickUpTask` (known intermittent 500s). Handoff staging: `offerHandoff`/`handoffPending` → classifier `handoff_response: 'accepted'` → `HandoffContactCard` → `createHighLevelLeadAndNotify` (venue + session ownership validated; contact upsert → tags → note → intro SMS; note and SMS failures tracked separately; failure still records a `HandoffRequest` with status/error). Known issue (project memory): HighLevel phone/contact dedupe caused missed SMS to planners; email-only upserts were removed for that reason.

**7.6 Availability & calendar sync.** Deterministic path: `checkDateAvailability` (single date w/ alternatives; `monthOpenings` mode w/ weekday filter). Sync: `GoogleCalendarSync.jsx` → `syncGoogleCalendar` (`list_calendars` → user picks → `sync_calendar`): persists `google_calendar_id`, 3-year window, paginated fetch (≤50 pages), timezone-correct multi-day expansion, dedupe by `google_event_id`, range updates preserve locally edited fields (couple/notes/deposit), duplicates archived via `merged_into_id`, every attempt audited to `CalendarSyncEvent` (fire-and-forget). Direction: **one-way Google → app** (no write-back found). Disconnect: detected as `not_connected` when the app-user token is missing/expired — surfaced in `CalendarConnectionHealth` and `CalendarSyncEvent`. Known past failure: `redirect_uri_mismatch` (Google Cloud Console config, resolved manually per project memory). Conflicts/duplicates: handled by merge logic above; no deletion of calendar-side events. Ops tools: `clearSyncedDates` (deletes local synced rows), `listMissingDates`, `debugAvailability`.

**7.7 Invitations/roles.** See 7.1; recovery: admin re-invites; no password-reset flow in app code (platform auth handles it — **inference**). No user-deletion or role-change UI (known gap; platform lacks documented SDK for it per project memory).

**7.8 Photos/visualization/first look.** `FeaturedPhotosManager` → `Core.UploadFile` → `VenuePhoto`. Visualizer: `VenueVisualizer` reads `VenueVisualizationPhoto` + `VisualizerHeroImage` → `generateVenueVisualization` (Stability inpainting w/ mask or img2img). First Look: `FirstLookSettings` → `FirstLookConfiguration` → chat renders `ChatVideoMessage`/`ChatEmptyState` Wistia embeds.

**7.9 Notifications/exports/analytics/scheduled tasks.** Notifications: HighLevel SMS + `Core.SendEmail` (invites) only — **no push, no webhooks, no scheduled jobs, no workflows** (directories absent — verified). Exports: none found in code (admin pages render data only). Analytics: `getBenchmarkingData` + dashboard widgets; `base44.analytics.track` **not found** in swept files (navigation tracking exists via `NavigationTracker` + vite plugin flags — platform-side).

**Absent/inaccessible workflows (explicitly):** no billing/payments flow (Stripe packages installed but unused), no workflows/agents, no webhook receivers, no data-retention jobs, no backup/export tooling in-app.

---

### 8. AI, chat, retrieval, and agents

**Model configuration (verified):**

- **Classifier** — `Core.InvokeLLM`, model **`gemini_3_flash`** (`useChatFlow.jsx:377`), schema `CLASSIFIER_SCHEMA` in `buildClassifierPrompt.jsx` (intents, topics, dates, guest count, `handoff_response`). Runs on **integration credits**.
- **Generator** — `invokeAnthropicGenerator` → **Anthropic `claude-sonnet-5`**, forced tool `reply` returning `{needsHandoff, topicSummary, acknowledgment, answer}`; 60s timeout, 2000 max tokens; **direct API key, not integration credits**. (Project memory: certain claude models returned `output_config.format` errors; this file pins `claude-sonnet-5`.)
- **Document/transcript/onboarding extraction** — `InvokeLLM` inside those functions (model unspecified in inspected lines; summary-verified).
- **Visualization** — Stability AI (see §7.8).

**Prompt assembly & precedence** (`useChatFlow.jsx:1180-1235` verified): topic-tagged retrieval from `VenueKnowledge` (no embeddings, no vector index — a primary-topic block + general-baseline block; empty-topic fallback to all rows); then `buildGeneratorPrompt` injects: today's date, venue/planner identity, availability verdict (composed **deterministically in code** via `composeAvailabilityReply` — the LLM never authors the verdict), month/package context, known-bride block (guest count/date/year), conditional DATE-CONFIRMED pricing instruction, pricing/capacity/handoff rules, and hard anti-hallucination constraints (never invent facts, never extend inclusion lists, yes/no verification rule — full text in `buildGeneratorPrompt.jsx`, verified this session).

**History & persistence:** last 6 messages sent as `recentHistory`; full transcript persisted to `ChatSession` (2s debounce) and localStorage (24h). No streaming; no token accounting on the classifier path (project memory: credit usage not programmatically exposed).

**Tool calling / writes:** no AI agent has tool access; AI never writes records. The only write-adjacent output is `needsHandoff`, consumed by deterministic code. `debugTraceRef` captures per-turn decisions, exported via `?debug=1` → `DebugTraceButton`, and attached to feedback records.

**Grounding & safety:** venue identity passed explicitly per message; date availability only from `checkDateAvailability` results; pricing only from knowledge/packages; prompts forbid promising calendar lookups; handoff offer must set `needsHandoff: true` (bidirectional rule in prompt). Cross-venue leakage is mitigated by explicit `venueId` filters on every chat-side query — **but** see §9 for RLS gaps. Prompt-injection hardening: the generator is instructed to ignore KB entries that tell it to transfer date/pricing questions; no other injection defenses (input is embedded in the prompt unsanitized — **inherent limitation, untested**).

**Agents:** none exist in-app (`base44/agents/` absent). This is separate from the Base44 build assistant, whose capabilities are outside the app.

---

### 9. Integrations, security, and operations

**Integration inventory**

| Service | Config location | Scopes/credentials | Callers | Failure handling |
|---|---|---|---|---|
| HighLevel (2 subaccounts) | Secrets + **hardcoded venue-ID→prefix map** in 5 functions (verified: `createHighLevelContact/entry.ts:116-128` `'696c4539…': ''`, `'6aac0d32…': 'CONRAD_'`) | API key per subaccount | lead/handoff, tours, quotes, connection checks | errors surfaced per-endpoint; partial writes recorded on HandoffRequest |
| Google Calendar | Workspace OAuth connector id `6a2b72d0b1ae3cefb36ece05` (modes: BYO-shared + app-user), used as **app-user** connection in `syncGoogleCalendar` | platform-stored token | calendar sync | `not_connected` status + CalendarSyncEvent audit |
| Anthropic | `ANTHROPIC_API_KEY` secret | — | generator | 502 on HTTP error, 60s abort |
| Stability AI | `STABILITY_API_KEY` | — | visualizer | error JSON |
| ClickUp | `CLICKUP_API_TOKEN` + list ID | — | feedback tasks | known 500s from anonymous context |
| Email | `Core.SendEmail` | platform | invites | status surfaced in SuperAdmin |
| File storage | `Core.UploadFile` / pdfjs client prep | platform | photos, documents | size rejection in `processVenueDocument` |
| Wistia | video IDs in `FirstLookConfiguration` | — | chat video messages | thumbnail fallback field exists |

**Security findings (evidence-based; confirmed defect vs untested concern marked):**

1. **Confirmed (schema-verified) RLS gaps:** `Venue.read` is `null` — any authenticated user (and the anonymous chatbot via `Venue.list()` in `Home.jsx:84`) can read **all** venues incl. planner names/domains/calendar IDs (no API keys live on Venue, mitigating). `VenueKnowledge.read` is open (`update/delete` are venue-or-admin — improved from the earlier fully-open state flagged in project memory). `ChatSession.update` and `ChatSession.create` are `null` — any caller can update any session's transcript/lead fields: **latent cross-tenant write exposure** (known issue, still present in schema). `ContactSubmission.create` null (needed for anonymous leads); `SavedBudgetEstimate.create/read` null. `VenueOperatingRules` has **no `rls` block at all** — platform default applies (unknown which).
2. **Confirmed:** unscoped reads in chat path — `Home.jsx:167-170` `BookedWeddingDate.list()` without venue filter (RLS read on that entity is venue-or-admin, so an anonymous bride's query likely returns empty/errors — behavior **runtime-unverified**; known issue lists AvailabilityChecker similarly).
3. **Confirmed:** `getChatFeedback` performs a service-role read of **all** feedback (transcripts + debug traces included) with **no auth check observed** in the inspected lines (`entry.ts:5-17`) — callable anonymously in principle. `Feedback.jsx` also lists `ChatFeedback` client-side (RLS-scoped). Untested at runtime, but the missing check is a suspected defect worth immediate review.
4. **Confirmed:** several public-facing functions (`createHighLevelLeadAndNotify`, `createHighLevelContact`, `createHighLevelAppointment`, `getHighLevelAvailability`, `sendBudgetQuote`, `checkDateAvailability`, `invokeAnthropicGenerator`) run **without auth by design** (anonymous chatbot) — their protection is input validation + venue-scoped reads. `invokeAnthropicGenerator` is an open proxy to a paid API for any caller holding the app URL — cost-abuse concern (untested).
5. **Confirmed:** per-venue credential routing requires **code changes + new secrets per venue** (hardcoded ID map) — scaling limitation, and `sendBudgetQuote`/wedding-date tools are **Sugar Lake-only** (unprefixed secrets).
6. **Confirmed:** `clearSyncedDates` requires auth but no venue-ownership check was observed in inspected lines — a venue user passing another `venue_id` could delete that venue's dates (partially inspected; verify before acting).
7. **Untested concerns:** no CSRF/replay protection on function endpoints (platform-managed layer unknown); no input sanitization of chat text before embedding into prompts (inherent LLM risk); venue-slug enumeration possible via `Venue.list()`.
8. **Positive controls verified:** `getChatSessionPublic` cross-venue 404; `syncGoogleCalendar` venue ownership; admin checks in pricing/benchmark functions; service-role usage is consistently paired with explicit `venue_id` filters in availability checks (PII-free outputs); secrets only referenced by literal name in functions; no secret values in any inspected file.

**Ops:** local setup = clone + `npm install` + `npm run dev` (Vite, port auto). Build/deploy: `npm run build` → `dist/`; publishing is a dashboard action (not reproducible here). Logs: dashboard **Logs** page (project memory: function logs incl. Anthropic token counts are visible there). Backups/rollback: **no platform deployment-history or export verified** (project memory confirms none found); git history is the only revision control. Tests: run manually `node tests/<file>.mjs` (4 files; cover session-creation retry logic, booking ranges, availability reply composition, HighLevel routing). Typecheck/lint via `npm run typecheck` / `npm run lint`.

---

### 10. Findings, coverage, and ongoing questions

**10.1 System summary.** A mature, multi-tenant, white-label venue-chatbot SaaS on Base44: React 18/Tailwind front end with a carefully hand-tuned conversational engine (deterministic availability + Anthropic generation over topic-filtered knowledge), HighLevel-first lead operations, Google Calendar one-way sync, and an admin suite (knowledge, bookings, pricing, invites, analytics). 28 Deno functions, 19 app entities, 12 secrets, no workflows/agents. Tenancy is enforced by convention (venue_id + RLS) with several known-open edges.

**10.2 Known defects / debt (evidence → impact)**

- **RLS open edges** (§9.1–9.2): cross-venue write/read exposure on ChatSession, Venue, SavedBudgetEstimate, etc. → privacy/compliance risk.
- **`getChatFeedback` missing auth** → possible anonymous PII/transcript exfiltration.
- **`OAuthConsent` apparently unrouted** (`pages.config.js` lacks it; no explicit Route) → MCP consent flow may 404.
- **Hardcoded HighLevel venue-ID→secret map** (5 functions) + Sugar Lake-only quote/diagnostic functions → every new venue needs code + secrets.
- **Legacy/duplicate UI**: `BudgetCalculator.jsx` vs `EnhancedBudgetCalculator`, `VenueSelector.jsx`, `PlannerTestChat.jsx`; unused `@stripe/*` deps.
- **No retention** for ChatSession/ChatFeedback/CalendarSyncEvent → unbounded growth.
- **Mixed backend SDK pins** (`npm:@base44/sdk` 0.8.6/0.8.25/0.8.31 across functions).
- **Platform bugs worked around** (documented, still relevant): anonymous ChatFeedback create can silently drop records (backend verify workaround); ClickUp task 500s; no deployment history; wildcard subdomains unsupported (per-venue CNAME needed).
- **Historically fixed, worth regression-testing:** feedback-on-published cache, invite-link domains, generator model errors, transcript restore race (tests exist for this one).
- **`?debug=1` trace UI** ships in the public chatbot (gated by param only) — harmless but reachable.

**10.3 Coverage matrix** — **Fully inspected (read this session):** `App.jsx`, `pages.config.js`, `Layout.jsx`, `Home.jsx`, `useChatFlow.jsx` (≈40% + call-site sweep of remainder), `VenueContext`, `AuthContext`, `app-params`, `syncGoogleCalendar`, `checkDateAvailability`, `invokeAnthropicGenerator`, `getChatSessionPublic` (partial), `createChatFeedback/getChatFeedback` (partial), `User.jsonc`, all entity schemas (19 via verified snapshot + User direct), `package.json`, lockfile versions, `vite.config.js`, `config.jsonc`, `index.html`, tree enumeration, git HEAD, 1 of 4 tests. **Partially inspected (greps + prior summaries):** 24 remaining functions (signatures/auth/entity lines), `HandoffContactCard`, `TourScheduler`, `AvailabilityChecker`, `LandingPage`, `OAuthConsent` (head), admin/flow components (call-site sweep only). **Not inspected / inaccessible:** dashboard (auth methods, RLS runtime, secret values, logs, domains, users), live database records, published-build runtime, `base44/mcp` config, `sendBudgetQuote`/`initializeSugarLakePricing` interiors beyond greps.

**10.4 Open questions & evidence needed**

1. Does RLS runtime actually enforce each `rls` block (esp. `{{user.venue_id}}` vs `{{user.data.venue_id}}` template inconsistency)? → dashboard test-user probing.
2. Is `OAuthConsent` reachable (platform-injected route or missing)? → publish + hit `/OAuthConsent`.
3. Which venue IDs map to which secrets in production (is `696c…` Sugar Lake)? → dashboard data read.
4. Does `clearSyncedDates` check venue ownership? → full read of that file.
5. Are `initializeSugarLakePricing`/`updateVenueBasePricing` still needed? → usage search in dashboards/logs.
6. App auth configuration (email/password? Google? public/private setting)? → dashboard Authentication page.

**10.5 Developer lookup index**

| Question | Where to look |
|---|---|
| "Why did the bot say X?" | `useChatFlow.jsx` (turn flow) → `buildClassifierPrompt.jsx` / `buildGeneratorPrompt.jsx`; `?debug=1` trace; `ChatFeedback.debug_trace` |
| "Date said open but it's booked" | `checkDateAvailability/entry.ts`, `BookedWeddingDate` (merged_into_id), `syncGoogleCalendar`, `CalendarSyncEvent` |
| "Handoff text never arrived" | `HandoffContactCard.jsx` → `createHighLevelLeadAndNotify/entry.ts` (HighLevel dedupe history) → `HandoffRequest.status/error_message` |
| "Change bot's tone/rules" | `buildGeneratorPrompt.jsx`; knowledge rows: `VenueKnowledge` (topic/category) |
| "Add a venue" | `SuperAdmin.jsx` → `Venue` (slug!) → `createUserInvite` → **code**: `highLevelConfig` maps in 5 functions + new secrets |
| "Pricing wrong in calculator" | `WeddingPricingConfiguration.pricing_data`; seeds: `initializeSugarLakePricing`; UI: `PricingManager.jsx` |
| "Calendar sync broken" | `GoogleCalendarSync.jsx`, `syncGoogleCalendar/entry.ts`, `CalendarConnectionHealth.jsx`, `CalendarSyncEvent` records |
| "Who can see my data?" | `rls` blocks in `base44/entities/*.jsonc` + function auth lines (§9) |
| "Where do invites come from?" | `createUserInvite` → `UserInvite` → `/Invite` (`validateUserInvite`/`acceptUserInvite`) |
| "Deploy/logs/credits" | Base44 dashboard (Logs, Plan/billing); no deployment history exists |

**Standing answer format for follow-ups (per your spec):** Direct answer → Current implementation evidence → Execution/data flow → Permissions and side effects → Related callers/dependencies → Edge cases and limitations → What remains unverified — with fresh re-inspection each time, since this report is a snapshot of HEAD `fdb858a` as of 2026-09-22 and will not remain current.

**Report complete: §1–§10 delivered. No application state was modified during this inspection.**
