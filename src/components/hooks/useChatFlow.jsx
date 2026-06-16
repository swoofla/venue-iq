import { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import parseDateFromText from './parseDateFromText';
import parseDatesFromText from './parseDatesFromText';

// ── Safe date formatting (NEVER use new Date('YYYY-MM-DD') — it parses as UTC and shifts) ──
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function partsFromIso(iso) {
  const [y, m, d] = iso.split('-').map(n => parseInt(n, 10));
  return { y, m, d, jsDate: new Date(y, m - 1, d) };
}

// "Saturday, October 17, 2026"
function formatFullDate(iso) {
  const { y, m, d, jsDate } = partsFromIso(iso);
  return `${DAY_NAMES[jsDate.getDay()]}, ${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

// "Friday, October 16" (no year — for alternate-date lists)
function formatShortDate(iso) {
  const { m, d, jsDate } = partsFromIso(iso);
  return `${DAY_NAMES[jsDate.getDay()]}, ${MONTH_NAMES[m - 1]} ${d}`;
}

function formatList(items) {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

// Ordinal suffix for a day-of-month integer: 1 → 'st', 2 → 'nd', 28 → 'th', ...
function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

export default function useChatFlow({
  venueId,
  venueName,
  venue,
  user,
  bookedDates,
  venueKnowledge,
  firstLookConfig,
}) {
  const [messages, setMessages] = useState([]);
  const [showGreeting, setShowGreeting] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [activeFlow, setActiveFlow] = useState(null);
  const [preSelectedDate, setPreSelectedDate] = useState('');
  const [originalQuestion, setOriginalQuestion] = useState('');
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [showTourPrompt, setShowTourPrompt] = useState(false);
  const [introResponded, setIntroResponded] = useState(true);
  const [welcomeVideoAdded, setWelcomeVideoAdded] = useState(false);
  const [additionalVideosAdded, setAdditionalVideosAdded] = useState(false);
  const [userWantsWelcomeVideo, setUserWantsWelcomeVideo] = useState(false);
  const [userWantsAdditionalVideos, setUserWantsAdditionalVideos] = useState(false);

  // Handoff: lightweight pending flag (no state machine, no message interception).
  // When a handoff offer is on screen, handoffPending holds the topicSummary so the
  // classifier knows to look for acceptance on the NEXT message. Any non-accepted
  // message clears it and flows through normal classifier → generator routing.
  const [handoffPending, setHandoffPending] = useState(null); // null | { topicSummary }

  // ChatSession tracking
  const [chatSessionId, setChatSessionId] = useState(null);
  const chatSessionIdRef = useRef(null);
  const messagesRef = useRef([]);
  const flowsCompletedRef = useRef([]);
  const flowResultsRef = useRef({});
  const leadWeddingDateRef = useRef(null);
  const leadGuestCountRef = useRef(null);
  const leadBudgetRangeRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // ── Conversational date resolution ──────────────────────────────────────
  // userFocusDateRef: the ISO date the bride most recently made the SUBJECT of an
  // inquiry. Updated ONLY when she asks about a single date, drills into one date
  // from a previous list, or corrects a date. NOT updated from bot-mentioned
  // alternatives or from multi-date lists until she narrows to one.
  const userFocusDateRef = useRef(null); // 'YYYY-MM-DD' | null
  // lastMultiMonthRef: when her most recent multi-date inquiry had a clear majority
  // month, we remember it as a fallback for resolving a later bare-day reference.
  const lastMultiMonthRef = useRef(null); // { month: 1-12, year: yyyy } | null
  // pendingDayAmbiguityRef: set when she gave a bare day-of-month ("the 28th") and
  // we cannot confidently determine the month. We post a reprompt and resolve from
  // her next message.
  const pendingDayAmbiguityRef = useRef(null); // { day: 1-31, candidates: [{month,year},...] } | null
  // Track which dates we've already checked this session so we don't re-prepend the
  // full "Good news —" verdict for a date that's already been discussed.
  const checkedDatesRef = useRef(new Set());

  // Build a { month, year } context for the date parsers from the focus date
  // (preferred) or the last multi-date inquiry's majority month (fallback).
  const buildDateContext = () => {
    if (userFocusDateRef.current) {
      const p = partsFromIso(userFocusDateRef.current);
      return { month: p.m, year: p.y };
    }
    if (lastMultiMonthRef.current) return lastMultiMonthRef.current;
    return null;
  };

  // Detect a bare day-of-month reference like "the 28th", "the 28", or a lone "28".
  // Returns the day number, or null. Skips messages that already contain a month name
  // or a slash/dash numeric date — those are not bare-day references.
  const detectBareDay = (text) => {
    if (!text) return null;
    const hasMonth = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\b/i.test(text);
    if (hasMonth) return null;
    if (/\b\d{1,2}[/-]\d{1,2}\b/.test(text) || /\b\d{4}-\d{1,2}-\d{1,2}\b/.test(text)) return null;
    const cleaned = text.replace(/(\d+)(st|nd|rd|th)\b/gi, '$1');
    const m = cleaned.match(/\bthe\s+(\d{1,2})\b/i) || cleaned.match(/(?:^|\s)(\d{1,2})(?:\s|$)/);
    if (!m) return null;
    const day = parseInt(m[1], 10);
    if (day < 1 || day > 31) return null;
    return day;
  };

  // From a list of ISO dates, return the majority month if a single month accounts
  // for STRICTLY MORE than half of the dates. Otherwise null (no confident majority).
  const getMajorityMonth = (isoDates) => {
    if (!Array.isArray(isoDates) || isoDates.length === 0) return null;
    const counts = new Map();
    for (const iso of isoDates) {
      const p = partsFromIso(iso);
      const key = `${p.y}-${p.m}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    let bestKey = null, bestN = 0;
    for (const [k, n] of counts) {
      if (n > bestN) { bestKey = k; bestN = n; }
    }
    if (bestKey && bestN > isoDates.length / 2) {
      const [y, m] = bestKey.split('-').map(Number);
      return { month: m, year: y };
    }
    return null;
  };

  // Distinct months represented in a list of ISO dates, preserving first-seen order.
  const distinctMonths = (isoDates) => {
    const seen = new Map();
    for (const iso of isoDates || []) {
      const p = partsFromIso(iso);
      const key = `${p.y}-${p.m}`;
      if (!seen.has(key)) seen.set(key, { month: p.m, year: p.y });
    }
    return Array.from(seen.values());
  };

  // Detect which one of `candidates` the user picked in a free-form reply like
  // "May", "June please", "the may one". Returns a candidate {month,year} or null.
  const matchAmbiguityAnswer = (text, candidates) => {
    if (!text || !candidates?.length) return null;
    for (const c of candidates) {
      const name = MONTH_NAMES[c.month - 1];
      const abbr = name.slice(0, 3);
      const re = new RegExp(`\\b(${name}|${abbr})\\b`, 'i');
      if (re.test(text)) return c;
    }
    return null;
  };

  const firstLookConfigRef = useRef(firstLookConfig);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    firstLookConfigRef.current = firstLookConfig;
  }, [firstLookConfig]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeFlow]);

  // Mirror messages into a ref so the debounce callback always has latest
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Ensure ChatSession exists — called lazily on first interaction
  const ensureChatSession = useCallback(async () => {
    if (chatSessionIdRef.current || !venueId) return chatSessionIdRef.current;
    try {
      const session = await base44.entities.ChatSession.create({
        venue_id: venueId,
        status: 'active',
        messages: [],
      });
      chatSessionIdRef.current = session.id;
      setChatSessionId(session.id);
      return session.id;
    } catch (err) {
      console.error('Failed to create ChatSession:', err?.message || err);
      return null;
    }
  }, [venueId]);

  // Debounced sync of messages to the ChatSession
  const scheduleSessionSync = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      const sid = chatSessionIdRef.current;
      if (!sid) return;
      const serialized = messagesRef.current
        .filter(m => !m.isVideo && typeof m.text === 'string')
        .map(m => ({
          role: m.isBot ? 'bot' : 'user',
          content: m.text,
          timestamp: new Date(typeof m.id === 'number' ? m.id : Date.now()).toISOString(),
        }));
      try {
        await base44.entities.ChatSession.update(sid, {
          messages: serialized,
          lead_name: leadName || undefined,
          lead_phone: leadPhone || undefined,
          lead_email: leadEmail || undefined,
          lead_wedding_date: leadWeddingDateRef.current || undefined,
          lead_guest_count: leadGuestCountRef.current || undefined,
          lead_budget_range: leadBudgetRangeRef.current || undefined,
          flows_completed: flowsCompletedRef.current,
          flow_results: flowResultsRef.current,
        });
      } catch (err) {
        console.error('ChatSession sync failed:', err?.message || err);
      }
    }, 2000);
  }, [leadName, leadPhone, leadEmail]);

  // Sync messages whenever they change (after ChatSession exists)
  useEffect(() => {
    if (!chatSessionId) return;
    scheduleSessionSync();
  }, [messages, chatSessionId, scheduleSessionSync]);

  const addBotMessage = (text) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { id: Date.now(), text, isBot: true }]);
      setIsTyping(false);
    }, 1000);
  };

  const addBotMessageImmediate = (text) => {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), text, isBot: true }]);
  };

  // Offer a handoff — marks pending and posts a warm bot line. NEVER intercepts.
  const offerHandoff = (topicSummary) => {
    const plannerName = venue?.planner_name || 'our planner';
    setHandoffPending({ topicSummary: topicSummary || 'general inquiry' });
    addBotMessage(`Of course — want me to have ${plannerName} text you directly? She usually responds within an hour or two.`);
  };

  // Public helper used by "Talk to a planner" link
  const requestPlannerHandoff = async () => {
    await ensureChatSession();
    offerHandoff('general inquiry');
  };

  // Append an inline contact-card message and the warm "drop your info" lead-in.
  const appendHandoffCard = (topicSummary) => {
    const plannerName = venue?.planner_name || 'our planner';
    setMessages(prev => [
      ...prev,
      { id: Date.now(), text: `Perfect — drop your name and number below and ${plannerName} will text you!`, isBot: true },
      { id: Date.now() + 1, isBot: true, isHandoffCard: true, topicSummary: topicSummary || 'general inquiry' },
    ]);
  };

  // Find the N nearest available dates to a target date.
  // PREFERENCE ORDER:
  //   1) Same day-of-week within ±6 weeks (a Saturday bride wants Saturdays)
  //   2) Fallback: nearest calendar days within ±120 days
  // Day-of-week is computed via partsFromIso (integer parts → local Date), never new Date('YYYY-MM-DD').
  const findNearestAvailableDates = async (targetDateStr, count = 3) => {
    if (!venueId || !targetDateStr) return [];
    const target = partsFromIso(targetDateStr);
    if (!target.jsDate || isNaN(target.jsDate.getTime())) return [];

    const [booked, blocked] = await Promise.all([
      base44.entities.BookedWeddingDate.filter({ venue_id: venueId }),
      base44.entities.BlockedDate.filter({ venue_id: venueId }),
    ]);
    const unavailable = new Set([
      ...booked.map(b => b.date),
      ...blocked.map(b => b.date),
    ]);

    // "Today" floor, computed in local time
    const now = new Date();
    const todayFloor = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Convert a local Date to YYYY-MM-DD without UTC shift
    const toIso = (jsDate) => {
      const y = jsDate.getFullYear();
      const m = String(jsDate.getMonth() + 1).padStart(2, '0');
      const d = String(jsDate.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    // Build a candidate at an offset (in days) from target, using local-date arithmetic
    const candidateAt = (offsetDays) => {
      const d = new Date(target.jsDate);
      d.setDate(d.getDate() + offsetDays);
      if (d < todayFloor) return null;
      const iso = toIso(d);
      if (unavailable.has(iso)) return null;
      return iso;
    };

    const results = [];
    const seen = new Set();
    const push = (iso) => {
      if (iso && !seen.has(iso)) {
        seen.add(iso);
        results.push(iso);
      }
    };

    // PASS 1 — same day-of-week, ±6 weeks (offsets ±7, ±14, ..., ±42)
    for (let weeks = 1; weeks <= 6 && results.length < count; weeks++) {
      for (const dir of [1, -1]) {
        if (results.length >= count) break;
        push(candidateAt(weeks * 7 * dir));
      }
    }

    // PASS 2 — fallback: nearest calendar days within ±120 days
    for (let offset = 1; offset <= 120 && results.length < count; offset++) {
      for (const dir of [1, -1]) {
        if (results.length >= count) break;
        push(candidateAt(offset * dir));
      }
    }

    return results;
  };

  const handleUserMessage = async (text) => {
    setShowGreeting(false);

    // Ensure session exists on first message
    await ensureChatSession();

    const userMsgId = Date.now();
    setMessages(prev => [...prev, { id: userMsgId, text, isBot: false }]);

    setIsTyping(true);

    // Guard against load race: wait for venueId to resolve before classifying/querying
    if (!venueId) {
      console.log('[useChatFlow] Waiting for venueId to resolve before processing message...');
      const start = Date.now();
      while (!venueId && Date.now() - start < 5000) {
        await new Promise(r => setTimeout(r, 100));
      }
      if (!venueId) {
        console.warn('[useChatFlow] venueId still not resolved after 5s — aborting message processing.');
        setIsTyping(false);
        setMessages(prev => [...prev, { id: Date.now(), text: "Sorry, I'm still loading. Could you try that again in a moment?", isBot: true }]);
        return;
      }
    }

    try {
      // ── STEP 1: Classify intent ─────────────────────────────────
      const recentHistory = [...messagesRef.current]
        .slice(-6)
        .map(m => `${m.isBot ? 'Bot' : 'User'}: ${m.text || ''}`)
        .join('\n');

      const today = new Date().toISOString().slice(0, 10);
      const tz = venue?.timezone || 'America/New_York';
      const plannerNameForClassifier = venue?.planner_name || 'our planner';

      const handoffPendingBlock = handoffPending ? `
A handoff offer (having ${plannerNameForClassifier} text the bride) is currently pending. Additionally return handoff_response: 'accepted' if this message clearly accepts being contacted (e.g. 'yes', 'sure', 'yes please text me'), 'declined' if it declines, or 'unrelated' otherwise. Farewells ('ok bye'), reactions ('wow'), and new questions are 'unrelated' — NEVER 'accepted'.
` : '';

      const classifier = await base44.integrations.Core.InvokeLLM({
        prompt: `You classify a bride's message to a wedding venue chatbot.

Today's date: ${today}
Venue timezone: ${tz}

Recent conversation (last 6 messages):
${recentHistory}

Current user message: "${text}"

Classify into one intent:
- "date_inquiry": asking whether a specific date or timeframe is available
- "tour_interest": wants to visit, see the venue in person, schedule a tour
- "package_inquiry": asking about packages, pricing tiers, what's included, costs, budget
- "visual_request": asking to see photos, what spaces look like, gallery
- "general": everything else (FAQs, policies, amenities, etc.)

When a message fits multiple intents, prefer the action intent (date_inquiry or tour_interest) over general.

Extract wedding_date: the specific date the bride is asking about, resolved to YYYY-MM-DD. If she gives a date without a year (e.g. "October 17th"), resolve to the next FUTURE occurrence relative to today. If she only mentions a month or vague timeframe ("next fall", "summer"), return null.

Extract guest_count: number if mentioned anywhere in recent context, otherwise null.

Also classify the PRIMARY topic of the bride's current message from this fixed vocabulary:
- catering: food, caterers, menu, dietary, tastings, plated vs buffet
- desserts: cake, cupcakes, cookies, sweets, dessert table
- alcohol_bar: drinks, bar, alcohol, beer, wine, signature cocktails, bartender
- packages_pricing: package options, what's included, total cost, price tiers, budget
- ceremony_spaces: where the ceremony happens, outdoor/indoor ceremony locations, arbor, aisle
- reception_spaces: reception room/tent/barn, where dinner & dancing happen
- lodging: on-site stay, cabins, hotels nearby, accommodations
- coordination_planning: day-of coordinator, planning support, timeline help, vendor management
- payment_deposits: deposits, payment schedule, refund policy, contracts
- decor_rentals: tables, chairs, linens, arches, in-house decor, rental items
- photography_video: photographer, videographer, photo/video vendors
- capacity_guests: max guest count, minimums, kids policy, plus-ones
- vendors: outside vendor policy, preferred vendor list, vendor restrictions
- rules_policies: noise/end times, fireworks, sparklers, pets, smoking, candles
- amenities: bridal suite, grooms room, parking, AV, wifi, heating/cooling, restrooms
- availability_dates: open/booked dates, calendar, peak vs off-season
- tours: visiting the venue, scheduling a walk-through
- getting_ready: bridal suite use, getting-ready timing, hair & makeup space
- general: greetings, intros, vibe questions, anything else

When a message spans topics, return the PRIMARY one.
${handoffPendingBlock}`,
        response_json_schema: {
          type: 'object',
          properties: {
            intent: { type: 'string', enum: ['general', 'date_inquiry', 'tour_interest', 'package_inquiry', 'visual_request'] },
            topic: { type: 'string', enum: ['catering','desserts','alcohol_bar','packages_pricing','ceremony_spaces','reception_spaces','lodging','coordination_planning','payment_deposits','decor_rentals','photography_video','capacity_guests','vendors','rules_policies','amenities','availability_dates','tours','getting_ready','general'] },
            wedding_date: { type: ['string', 'null'] },
            wedding_dates: { type: ['array', 'null'], items: { type: 'string' } },
            guest_count: { type: ['number', 'null'] },
            handoff_response: { type: ['string', 'null'], enum: ['accepted', 'declined', 'unrelated', null] },
          },
          required: ['intent']
        }
      });

      console.log('CLASSIFIER:', JSON.stringify(classifier));

      // Handoff acceptance: append inline card, clear pending, stop here.
      if (handoffPending && classifier?.handoff_response === 'accepted') {
        const topic = handoffPending.topicSummary;
        setHandoffPending(null);
        setIsTyping(false);
        appendHandoffCard(topic);
        return;
      }
      // Any non-accepted message clears the pending offer; conversation continues normally.
      if (handoffPending) setHandoffPending(null);

      const intent = classifier?.intent || 'general';
      const guestCount = classifier?.guest_count || null;

      // ── Resolve pending day-of-month ambiguity from this message ────────
      // If we previously asked "The 28th of May or June?" and this message names
      // one of the candidate months, build the ISO directly and skip the parsers.
      let ambiguityResolvedIso = null;
      if (pendingDayAmbiguityRef.current) {
        const { day, candidates } = pendingDayAmbiguityRef.current;
        const picked = matchAmbiguityAnswer(text, candidates);
        if (picked) {
          const candidate = new Date(picked.year, picked.month - 1, day);
          if (candidate.getMonth() === picked.month - 1 && candidate.getDate() === day) {
            const y = candidate.getFullYear();
            const m = String(candidate.getMonth() + 1).padStart(2, '0');
            const d = String(candidate.getDate()).padStart(2, '0');
            ambiguityResolvedIso = `${y}-${m}-${d}`;
          }
          pendingDayAmbiguityRef.current = null;
        }
        // If she didn't pick a candidate, leave pending in place; the parsers run normally.
      }

      // Deterministic date parsing takes priority over the classifier's wedding_date(s).
      // Multi-date parser runs first; if it returns >1 dates we use them as a list.
      // Otherwise fall back to single-date parser, then classifier.
      // Both parsers receive the conversational date context (focus date or last
      // multi-date majority month) so bare-day references ("the 28th") and bare
      // month+day ("May 28") resolve correctly against the ongoing thread.
      const dateContext = buildDateContext();
      const deterministicDates = parseDatesFromText(text, dateContext);
      const deterministicDate = ambiguityResolvedIso || parseDateFromText(text, dateContext);
      const classifierDates = Array.isArray(classifier?.wedding_dates)
        ? classifier.wedding_dates.filter(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
        : [];
      let weddingDates = [];
      if (!ambiguityResolvedIso && deterministicDates.length > 1) {
        weddingDates = deterministicDates;
      } else if (!ambiguityResolvedIso && classifierDates.length > 1) {
        weddingDates = classifierDates;
      }
      weddingDates = weddingDates.slice(0, 5); // cap at 5 per spec
      const weddingDate = deterministicDate || classifier?.wedding_date || (weddingDates[0] || null);
      console.log('[useChatFlow] Date parsing — ambiguityResolved:', ambiguityResolvedIso, '| deterministicDates:', deterministicDates, '| deterministicDate:', deterministicDate, '| classifier:', classifier?.wedding_date, classifier?.wedding_dates, '| final single:', weddingDate, '| final multi:', weddingDates, '| focus:', userFocusDateRef.current, '| multiMonth:', lastMultiMonthRef.current);

      // ── Ambiguity guard: bare day with no confident month → reprompt ────
      // Trigger only when:
      //  - intent is a date inquiry,
      //  - we detect a bare day-of-month in the message,
      //  - no single date was resolved (parsers returned nothing usable),
      //  - we have NO focus date and NO majority-month fallback,
      //  - the last multi-date inquiry had 2+ distinct months we can offer as choices.
      if (
        intent === 'date_inquiry' &&
        !weddingDate &&
        weddingDates.length === 0 &&
        !dateContext
      ) {
        const bareDay = detectBareDay(text);
        if (bareDay) {
          // Build candidate months from the last multi inquiry, if any.
          // Fall back to gracefully asking in prose if we have nothing to offer.
          const lastMulti = (() => {
            // Walk back through user messages to find the most recent multi-date inquiry's dates.
            const userMsgs = [...messagesRef.current].filter(m => !m.isBot);
            for (let i = userMsgs.length - 1; i >= 0; i--) {
              const meta = userMsgs[i].metadata;
              if (meta?.intent === 'date_inquiry' && Array.isArray(meta.wedding_dates) && meta.wedding_dates.length > 1) {
                return meta.wedding_dates;
              }
            }
            return [];
          })();
          const candidates = distinctMonths(lastMulti).slice(0, 2);
          if (candidates.length >= 2) {
            pendingDayAmbiguityRef.current = { day: bareDay, candidates };
            const label = (c) => MONTH_NAMES[c.month - 1];
            const reprompt = `The ${bareDay}${ordinal(bareDay)} of ${label(candidates[0])} or ${label(candidates[1])}?`;
            setIsTyping(false);
            setMessages(prev => [...prev, { id: Date.now(), text: reprompt, isBot: true }]);
            return;
          }
          // No prior multi-month list to draw from → ask freely.
          setIsTyping(false);
          setMessages(prev => [...prev, { id: Date.now(), text: `Which month — the ${bareDay}${ordinal(bareDay)} of which month?`, isBot: true }]);
          return;
        }
      }

      // Persist intent metadata onto the user message (flows through ChatSession sync)
      setMessages(prev => prev.map(m =>
        m.id === userMsgId
          ? { ...m, metadata: { intent, wedding_date: weddingDate, wedding_dates: weddingDates, guest_count: guestCount } }
          : m
      ));

      if (guestCount && !leadGuestCountRef.current) leadGuestCountRef.current = guestCount;
      if (weddingDate && !leadWeddingDateRef.current) leadWeddingDateRef.current = weddingDate;

      // ── Update focus / multi-month state based on what she just did ─────
      // Focus updates when she lands on ONE date: a single-date inquiry, an
      // ambiguity resolution, or drilling into one date from a previous list.
      // It does NOT update from bot-mentioned alternatives or from a list.
      if (intent === 'date_inquiry') {
        if (weddingDates.length > 1) {
          // Multi-date list → do NOT touch focus; refresh majority-month fallback.
          const majority = getMajorityMonth(weddingDates);
          if (majority) lastMultiMonthRef.current = majority;
        } else if (weddingDate) {
          userFocusDateRef.current = weddingDate;
        }
      }

      // Detect rapid date-checking: previous USER message was also a date_inquiry
      const previousUserMsg = [...messagesRef.current]
        .filter(m => !m.isBot && m.id !== userMsgId)
        .pop();
      const isRapidDateCheck =
        intent === 'date_inquiry' &&
        previousUserMsg?.metadata?.intent === 'date_inquiry';
      console.log('[useChatFlow] Rapid date-check mode:', isRapidDateCheck);

      // ── STEP 2: Route by intent ─────────────────────────────────
      let availabilityContext = '';
      let packageContext = '';
      let monthContext = '';
      let verdictSentence = '';
      let compactReply = '';
      const plannerNameEarly = venue?.planner_name || 'our planner';

      // ── Multi-date branch: always compact, no generator call ─────
      if (intent === 'date_inquiry' && weddingDates.length > 1) {
        try {
          const nowParts = (() => {
            const n = new Date();
            return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
          })();
          const isPastIso = (iso) => {
            const p = partsFromIso(iso);
            if (p.y !== nowParts.y) return p.y < nowParts.y;
            if (p.m !== nowParts.m) return p.m < nowParts.m;
            return p.d < nowParts.d;
          };

          const results = await Promise.all(
            weddingDates.map(d => {
              if (isPastIso(d)) {
                return Promise.resolve({ date: d, isPast: true });
              }
              return base44.functions.invoke('checkDateAvailability', {
                venueId,
                date: d,
                alternativesCount: 0,
              }).then(r => ({ date: d, isAvailable: r?.data?.isAvailable !== false }))
                .catch(() => ({ date: d, isAvailable: null }));
            })
          );
          const lines = results.map(r => {
            const label = formatShortDate(r.date);
            if (r.isPast) return `${label}: already passed`;
            if (r.isAvailable === null) return `${label}: let me double-check`;
            return `${label}: ${r.isAvailable ? 'open' : 'already booked'}`;
          });
          const multiReply = `Here's what I found — ${lines.join(' · ')}. Want me to check any others?`;
          // Record checked dates. Focus is intentionally NOT updated — she hasn't
          // narrowed to one date yet. Majority-month fallback was refreshed above.
          results.forEach(r => { if (!r.isPast) checkedDatesRef.current.add(r.date); });
          setIsTyping(false);
          setMessages(prev => [...prev, { id: Date.now(), text: multiReply, isBot: true }]);
          return;
        } catch (err) {
          console.error('Multi-date availability check failed:', err?.message || err);
          // Fall through to generic handling if something truly broke
        }
      }

      if (intent === 'date_inquiry' && weddingDate) {
        // ── Past-date guard ─────────────────────────────────────────
        // Never run availability or declare "open" for a date that's already past.
        // Compose a heads-up in code; if a same-day-of-week future date is obvious,
        // check THAT one instead and note the year.
        const todayParts = (() => {
          const n = new Date();
          return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
        })();
        const isPast = (() => {
          const p = partsFromIso(weddingDate);
          if (p.y !== todayParts.y) return p.y < todayParts.y;
          if (p.m !== todayParts.m) return p.m < todayParts.m;
          return p.d < todayParts.d;
        })();

        let effectiveDate = weddingDate;
        let pastHeadsUp = '';
        if (isPast) {
          const formattedPast = formatFullDate(weddingDate);
          // Next future occurrence of the same month/day, same day-of-week preferred.
          const p = partsFromIso(weddingDate);
          let candidateYear = todayParts.y;
          // Walk forward year-by-year until the date is today or later AND day-of-week matches original.
          // Cap at +10 years to avoid runaway loops.
          const originalDow = p.jsDate.getDay();
          let chosen = null;
          for (let i = 0; i < 10 && !chosen; i++) {
            const test = new Date(candidateYear + i, p.m - 1, p.d);
            const testFloor = new Date(test.getFullYear(), test.getMonth(), test.getDate());
            const todayFloor = new Date(todayParts.y, todayParts.m - 1, todayParts.d);
            if (testFloor >= todayFloor && test.getDay() === originalDow) {
              chosen = test;
            }
          }
          if (!chosen) {
            // Fallback: just next year regardless of weekday match.
            chosen = new Date(p.y + 1, p.m - 1, p.d);
          }
          const y = chosen.getFullYear();
          const m = String(chosen.getMonth() + 1).padStart(2, '0');
          const d = String(chosen.getDate()).padStart(2, '0');
          effectiveDate = `${y}-${m}-${d}`;
          const formattedFuture = formatFullDate(effectiveDate);
          pastHeadsUp = `Just a heads up — ${formattedPast} has already passed! Did you mean ${formattedFuture}? `;
          // Advance focus to the future date we're actually checking.
          userFocusDateRef.current = effectiveDate;
        }

        // ── Repeat-date handling ────────────────────────────────────
        const alreadyChecked = checkedDatesRef.current.has(effectiveDate);

        try {
          const availRes = await base44.functions.invoke('checkDateAvailability', {
            venueId,
            date: effectiveDate,
            alternativesCount: 3,
          });
          const availData = availRes?.data || {};
          if (availData.error) throw new Error(availData.error);
          const isTaken = availData.isAvailable === false;
          const formattedRequested = formatFullDate(effectiveDate);

          if (isTaken) {
            const nearest = Array.isArray(availData.alternatives) ? availData.alternatives : [];
            const formattedNearest = nearest.map(formatShortDate);
            availabilityContext = `AVAILABILITY CHECK RESULT: ${effectiveDate} is BOOKED. Nearest available: [${nearest.join(', ')}]`;
            if (alreadyChecked) {
              verdictSentence = `Right — ${formattedRequested}, and it's already booked.`;
            } else {
              verdictSentence = nearest.length > 0
                ? `${pastHeadsUp}I'm so sorry — ${formattedRequested} is already booked. The closest open dates are ${formatList(formattedNearest)}.`
                : `${pastHeadsUp}I'm so sorry — ${formattedRequested} is already booked.`;
            }
            if (isRapidDateCheck) {
              compactReply = alreadyChecked
                ? `Right — ${formattedRequested}, still booked.`
                : (nearest.length > 0
                    ? `${pastHeadsUp}Unfortunately, ${formattedRequested} is already booked — but ${formatList(formattedNearest)} are open. Any others you'd like to check?`
                    : `${pastHeadsUp}Unfortunately, ${formattedRequested} is already booked. Any others you'd like to check?`);
            }
          } else {
            availabilityContext = `AVAILABILITY CHECK RESULT: ${effectiveDate} is AVAILABLE`;
            if (alreadyChecked) {
              verdictSentence = `Right — ${formattedRequested}, and it's open.`;
            } else {
              verdictSentence = `${pastHeadsUp}Good news — ${formattedRequested} is open!`;
            }
            if (isRapidDateCheck) {
              compactReply = alreadyChecked
                ? `Right — ${formattedRequested}, still open.`
                : `${pastHeadsUp}Yes — ${formattedRequested} is open! Any other dates you'd like to check?`;
            }
          }

          // Mark this date as checked AFTER we've used the alreadyChecked flag.
          checkedDatesRef.current.add(effectiveDate);

          const monthNum = parseInt(effectiveDate.slice(5, 7), 10);
          const monthName = MONTH_NAMES[monthNum - 1];
          monthContext = `Date month: ${monthName} (apply any seasonal knowledge — e.g. Jan–Mar policy, off-season guest caps).`;
        } catch (err) {
          console.error('Availability check failed:', err?.message || err);
          availabilityContext = `AVAILABILITY CHECK FAILED: do not state whether the date is open or booked. Warmly say you want to double-check that date and offer to have the planner confirm it.`;
          verdictSentence = `${pastHeadsUp}I want to double-check that date for you — let me have ${plannerNameEarly} confirm it!`;
          if (isRapidDateCheck) compactReply = verdictSentence;
        }
      }

      console.log('AVAILABILITY CONTEXT:', availabilityContext);
      console.log('VERDICT SENTENCE:', verdictSentence);

      // Compact mode: skip the generator LLM entirely and post the code-composed reply
      if (compactReply) {
        setIsTyping(false);
        setMessages(prev => [...prev, { id: Date.now(), text: compactReply, isBot: true }]);
        return;
      }

      if (intent === 'package_inquiry' && venueId) {
        const pkgs = await base44.entities.VenuePackage.filter({ venue_id: venueId, is_active: true });
        packageContext = 'ACTIVE PACKAGES:\n' + pkgs
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
          .map(p => `- ${p.name} — $${p.price?.toLocaleString?.() || p.price} (up to ${p.max_guests} guests)\n  ${p.description || ''}\n  Includes: ${(p.includes || []).join('; ')}`)
          .join('\n\n');
      }

      // ── Topic-focused knowledge assembly ─────────────────────────
      const topic = classifier?.topic || 'general';
      const formatEntry = (k) => `Q: ${k.question}\nA: ${k.answer}`;
      const primaryEntries = venueKnowledge.filter(k => k.topic === topic && topic !== 'general');
      const generalBaseline = venueKnowledge.filter(k => k.topic === 'general');
      const matchCount = primaryEntries.length;
      console.log('TOPIC:', topic, '| entries matched:', matchCount);

      let knowledgeContext;
      if (matchCount === 0) {
        // Migration safety: if no entries are tagged for this topic, fall back to all.
        knowledgeContext = venueKnowledge.map(formatEntry).join('\n\n');
      } else {
        const primaryBlock = `=== EVERYTHING ${venueName.toUpperCase()} KNOWS ABOUT ${topic.toUpperCase().replace(/_/g, ' ')} ===\n${primaryEntries.map(formatEntry).join('\n\n')}`;
        const generalBlock = generalBaseline.length > 0
          ? `\n\n=== GENERAL VENUE KNOWLEDGE (baseline) ===\n${generalBaseline.map(formatEntry).join('\n\n')}`
          : '';
        knowledgeContext = primaryBlock + generalBlock;
      }

      const plannerName = venue?.planner_name || 'our planner';
      const plannerTitle = venue?.planner_title || 'our planner';

      // ── STEP 3: Generate response ───────────────────────────────
      const generator = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a warm, helpful wedding venue chatbot for ${venueName}. Respond conversationally to the bride.

VIRTUAL PLANNER STANCE:

You are Sugar Lake's virtual planner in a live planning conversation — not a human texting. NEVER use sign-offs or farewell phrasing mid-conversation ('Happy Planning', 'Cheers', 'Talk soon', 'Have a great day'). The conversation is ongoing until she leaves.
Your purpose is bigger than answering questions: help her discover Sugar Lake and picture HER wedding here. Every reply should quietly move her planning forward.
After answering, open ONE door. Ways to do this: connect the fact to something she's already shared (her date, season, guest count — e.g. 'and since you're looking at late May, the wisteria will be in full bloom'), surface one adjacent thing she'd likely want next, or offer to go deeper ('Want me to walk you through how a wedding day here usually flows?'). An offer counts — it doesn't have to be a question.
Forward motion stays light: one door per reply, never two. Never hard-sell, never push a tour unless she signals interest. If she ignored your last opening, answer cleanly and don't reuse that kind of opening next time.
Match her energy on length — short functional questions get efficient answers — but efficiency never means dead-ends: even a short answer can carry a six-word door.
Warm Sugar Lake personality: at most one emoji per message ( 😊 💕 🎉 ), after warmth or good news, never inside prices or availability facts. If she says she booked elsewhere: congratulate genuinely, thank her, wish her well — no counter-selling. This is the one case where a warm goodbye is right.
Answer first. No preamble like 'Great question!' or 'That's a wonderful thought!'
When the bride corrects you or points out an inconsistency: acknowledge in a few plain words ('You're right —'), give the corrected answer, and move on. No effusive praise for catching it, no over-apologizing.
Answer the question that was asked with the facts provided. Do NOT invent hypothetical complications (e.g., speculating she might have more guests than a package allows) unless she has stated something that creates the issue.
If asked the price of a date that's already booked: give the normal price for that day and season anyway (it's useful for comparison), with a gentle note that the date itself is taken.
Offer the ${plannerName} handoff at most once per topic. If a handoff offer was made in the last two bot messages, do not offer again — just answer as well as you can.
YOUR ROLE (NOT A SALESPERSON):
You are a thoughtful wedding planner helping the bride explore Sugar Lake and decide for herself whether it's the right fit — not a salesperson funneling her toward a booking. The "Book a tour" button is always visible in the header, so she can start a tour herself whenever she's ready; you never prompt it. Do NOT end answers with a tour or booking call-to-action. Only mention scheduling a tour if (a) the bride herself raises visiting, scheduling, or booking, or (b) she seems stuck or overwhelmed and connecting with a real person would genuinely help.

ANSWER HONESTLY, NEVER TEASE:
Answer fully in one pass using only the knowledge provided to you in THIS message. Never hold detail back to offer "more later," and never offer to share detail that isn't actually in the knowledge you were given — scan it before making any claim or offer. If the knowledge has only names or a list without descriptions, share what you have plainly; don't promise descriptions you don't have. If you make any offer and the bride accepts, you must be able to deliver real specifics from the provided knowledge.

HOW TO CLOSE — ASK LIKE A PLANNER:
After you answer, do NOT offer to tell her more about the thing you just covered (e.g., "want to hear more about the cabins?"). That's a dead end — it just asks her to re-request what you already gave her.

Instead, close the way a thoughtful planner would: ask ONE warm, forward-looking question that helps her clarify what she's envisioning, or that helps both of you see whether Sugar Lake fits her wedding. The strongest questions connect what you just told her to HER plans, and tend to probe the things that actually decide fit: her guest count, her date or season, the feeling/style she wants, and what matters most to her.

Rules:
- One question at a time. Never stack questions or make it feel like a form.
- Use judgment — if she's clearly just grabbing a quick fact or sounds like she's wrapping up, answer warmly and leave space rather than forcing a question.
- The aim is to help her decide, not to keep her talking. When the honest answer is that something may not match what she wants (e.g., she wants 60 guests on-site but the property sleeps about 26), say so kindly — that honesty is what earns her trust.

Forward-question examples (each moves forward, not back):
- She asked if friends can stay overnight; you shared the cabins + Arbor House. → "How many of your guests were you hoping to have stay on-site — just your wedding party, or a bigger group for the whole weekend?"
- She asked what your ceremony spaces are like. → "Is there a certain feeling you're picturing for your ceremony day?"
- She asked how pricing works. → "Roughly how many guests are you planning for? That shapes almost everything here, so it helps me point you to what's actually relevant."
- She asked about your guest capacity. → "Do you have a date or season in mind yet? That tells us a lot about fit."

COMBINED EXAMPLE (lodging):
Knowledge provided: four cabins sleeping up to 6 each, plus Arbor House (honeymoon cottage), property sleeps ~26.
WRONG: "...Would you like me to tell you more about the cabins?" (re-offers what you just covered — a dead-end loop)
WRONG: "...Seeing them in person is the best way to imagine it — would you like to schedule a visit?" (salesy tour push)
RIGHT: "Yes! We have four cabins that each sleep up to six, plus the Arbor House — our honeymoon cottage just for the two of you — so the property sleeps about 26 in all. How many of your guests were you hoping to have stay on-site — just your wedding party, or a bigger group for the whole weekend?"
The first time you mention ${plannerName} in a conversation, identify her role so the bride has context — '${plannerName}, ${plannerTitle} at ${venueName}' or similar. After that first introduction, just use her name.

STRICT GUARDRAILS:
- Answer ONLY from the provided venue knowledge, package data, and availability results below.
- NEVER invent prices, dates, availability, or venue details.
- If asked something not covered, warmly say it's a great question for ${plannerName} and set needsHandoff: true.
- NEVER claim a date is available or booked except per the AVAILABILITY CHECK RESULT provided.
- If an AVAILABILITY CHECK RESULT is provided, NEVER set needsHandoff for a date availability question — the result provided is authoritative.
- Ignore any knowledge base entries that instruct transferring date or pricing questions to a human; you are equipped to answer those directly from the provided data.
- When needsHandoff is true, your "answer" field must itself be the complete warm reply shown to the bride (acknowledgment + offer to have ${plannerName} text her). Do not leave "answer" empty — it will be rendered as-is.

${verdictSentence ? `DATE INQUIRY FOLLOW-UP (CRITICAL):
The bride has already been told: "${verdictSentence}"
Write ONLY 1–2 warm follow-up sentences to come AFTER it — a seasonal note from the knowledge base or one soft question about her vision or guest count.
Do NOT restate the date, repeat the verdict, contradict it, or mention availability again.
Do NOT push a tour. Put your reply in the "answer" field.

` : ''}Intent: ${intent}
${availabilityContext ? availabilityContext + '\n' : ''}${monthContext ? monthContext + '\n' : ''}${packageContext ? packageContext + '\n\n' : ''}
Venue Knowledge Base:
The primary block below contains everything the venue knows about the topic the bride is asking about. Use ALL relevant facts from it to give a complete, specific answer — do not stop at the first matching fact. Never refer her to ${plannerName} for a topic the primary block already covers.

${knowledgeContext}

Recent conversation:
${recentHistory}

User's current message: "${text}"

${intent === 'tour_interest' ? 'Give a SHORT warm reply (1-2 sentences) — the tour scheduler will open right after.' : ''}
${intent === 'visual_request' ? 'No photo gallery exists yet. Warmly describe the relevant spaces from the knowledge base and offer a tour to see them in person.' : ''}
${intent === 'date_inquiry' && !weddingDate ? 'Respond naturally and ask which date or timeframe she\'s considering.' : ''}

Before considering a handoff, check whether the knowledge base contains anything related to the question — including general policies like the outside-vendor policy that may answer it indirectly. If related knowledge exists, answer from it warmly, and at most add a light offer to confirm specifics with ${plannerName}. Set needsHandoff: true ONLY when the knowledge base contains nothing relevant at all, the topic involves contracts/refunds/payment disputes or emotionally sensitive situations, or the bride explicitly asks for a human. A partial answer with a confirm-offer is ALWAYS better than a pure handoff.`,
        response_json_schema: {
          type: 'object',
          properties: {
            needsHandoff: { type: 'boolean' },
            topicSummary: { type: 'string' },
            acknowledgment: { type: 'string' },
            answer: { type: 'string' }
          },
          required: ['needsHandoff']
        },
        model: 'claude_opus_4_8'
      });

      setIsTyping(false);

      const generatorFollowUp = (generator?.answer || '').trim();
      let answer;
      if (verdictSentence) {
        // Compose in code so the verdict is ALWAYS present, regardless of LLM output
        answer = generatorFollowUp
          ? `${verdictSentence} ${generatorFollowUp}`
          : verdictSentence;
      } else {
        answer = generatorFollowUp || "Thanks for reaching out! What would you like to know more about?";
      }

      setMessages(prev => [...prev, { id: Date.now(), text: answer, isBot: true }]);

      if (generator?.needsHandoff && !verdictSentence) {
        const topic = generator.topicSummary || 'your question';
        setHandoffPending({ topicSummary: topic });
      }

      // Trigger tour scheduler after the warm reply for tour_interest
      if (intent === 'tour_interest') {
        setTimeout(() => setActiveFlow('tour'), 1200);
      }
    } catch (error) {
      console.error('Intent routing error:', error?.message || error);
      setIsTyping(false);
      setMessages(prev => [...prev, { id: Date.now(), text: "Thanks for reaching out! What would you like to know more about?", isBot: true }]);
    }
  };

  const handleQuickAction = (action) => {
    setShowGreeting(false);
    ensureChatSession();

    switch (action) {
      case 'budget':
        setMessages(prev => [...prev, { id: Date.now(), text: "I'd like to use the budget calculator", isBot: false }]);
        addBotMessage("Perfect! Let's find the ideal package for your budget. I'll guide you through a few questions to understand your vision.");
        setTimeout(() => setActiveFlow('budget'), 1500);
        break;
      case 'availability':
        setMessages(prev => [...prev, { id: Date.now(), text: "I want to check date availability", isBot: false }]);
        addBotMessage("Great choice! Let's see if your dream date is available. Please select a date from the calendar below.");
        setTimeout(() => setActiveFlow('availability'), 1500);
        break;
      case 'tour':
        setMessages(prev => [...prev, { id: Date.now(), text: "I'd like to schedule a tour", isBot: false }]);
        addBotMessage("Wonderful! We'd love to welcome you to Sugar Lake and show you around in person. Let's find a time that works best for you.");
        setTimeout(() => setActiveFlow('tour'), 1500);
        break;
      case 'packages':
        setMessages(prev => [...prev, { id: Date.now(), text: "Show me your packages", isBot: false }]);
        addBotMessage("Excellent! Here are our three beautiful packages, each thoughtfully designed to create an unforgettable celebration. Take a look:");
        setTimeout(() => setActiveFlow('packages'), 1500);
        break;
      case 'gallery':
        setMessages(prev => [...prev, { id: Date.now(), text: "I'd like to see photos of the venue", isBot: false }]);
        addBotMessage("I'd love to show you around! Here's a tour of our beautiful spaces. ✨");
        setTimeout(() => setActiveFlow('gallery'), 1000);
        break;
      case 'visualizer':
        setMessages(prev => [...prev, { id: Date.now(), text: "I want to visualize my wedding design", isBot: false }]);
        addBotMessage("How exciting! Let's create a custom vision of what your wedding could look like at our venue. ✨");
        setTimeout(() => setActiveFlow('visualizer'), 1000);
        break;
      case 'contact':
        setMessages(prev => [...prev, { id: Date.now(), text: "I'd like to talk to a real person", isBot: false }]);
        offerHandoff('general inquiry');
        break;
    }
  };

  const handleBudgetComplete = async (data) => {
    setActiveFlow(null);
    setLeadName(data.name);
    setLeadEmail(data.email);
    setLeadPhone(data.phone);

    if (data.guestCount) {
      leadGuestCountRef.current = parseInt(data.guestCount) || null;
    }
    flowsCompletedRef.current = Array.from(new Set([...(flowsCompletedRef.current || []), 'budget_calculator']));
    flowResultsRef.current = {
      ...flowResultsRef.current,
      budget_calculator: { total: data.totalBudget }
    };
    if (data.totalBudget) {
      const k = Math.round(data.totalBudget / 1000);
      leadBudgetRangeRef.current = `$${k}k`;
    }

    const deliveryMessage = data.deliveryPreference === 'text'
      ? `sent to your phone`
      : `sent to your email`;

    setMessages(prev => [...prev, {
      id: Date.now(),
      text: `Budget estimate submitted - ${data.guestCount} guests, $${data.totalBudget.toLocaleString()}`,
      isBot: false
    }]);

    setTimeout(() => {
      addBotMessage(
        `Perfect! Your personalized budget estimate of $${data.totalBudget.toLocaleString()} has been ${deliveryMessage}. 💌\n\nWould you like to schedule a tour to see the venue in person? We'd love to walk you through the spaces and discuss your vision!`
      );
      setShowTourPrompt(true);
    }, 1000);
  };

  const handleAvailabilityTour = (date) => {
    setActiveFlow(null);
    leadWeddingDateRef.current = date;
    flowsCompletedRef.current = Array.from(new Set([...(flowsCompletedRef.current || []), 'date_check']));
    flowResultsRef.current = {
      ...flowResultsRef.current,
      date_check: { date, available: true }
    };
    setMessages(prev => [...prev, {
      id: Date.now(),
      text: `${date} is available!`,
      isBot: false
    }]);
    addBotMessage(`Great news! ${date} is available. Let's get your tour scheduled so you can see the venue in person.`);
    setTimeout(() => {
      setPreSelectedDate(date);
      setActiveFlow('tour');
    }, 1500);
  };

  const handleTourComplete = async (data) => {
    setActiveFlow(null);

    setMessages(prev => [...prev, {
      id: Date.now(),
      text: `Tour scheduled for ${data.tourDate} at ${data.tourTime}`,
      isBot: false
    }]);

    if (data.weddingDate) leadWeddingDateRef.current = data.weddingDate;
    if (data.guestCount) leadGuestCountRef.current = parseInt(data.guestCount) || null;
    flowsCompletedRef.current = Array.from(new Set([...(flowsCompletedRef.current || []), 'tour_scheduler']));
    flowResultsRef.current = {
      ...flowResultsRef.current,
      tour_scheduler: { tour_date: data.tourDate, tour_time: data.tourTime }
    };

    const venues = await base44.entities.Venue.list();
    const sugarLakeVenue = venues.find(v => v.name.toLowerCase().includes('sugar lake')) || venues[0];

    const submissionData = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      wedding_date: data.weddingDate,
      guest_count: parseInt(data.guestCount) || null,
      tour_date: data.tourDate,
      tour_time: data.tourTime,
      source: 'tour_scheduler',
      venue_id: sugarLakeVenue?.id,
    };

    await base44.entities.ContactSubmission.create(submissionData);

    try {
      const contactRes = await base44.functions.invoke('createHighLevelContact', {
        email: data.email,
        name: data.name,
        phone: data.phone,
        wedding_date: data.weddingDate,
        guest_count: data.guestCount,
        source: 'tour_scheduler'
      });
      console.log('Contact created:', contactRes.data);

      const appointmentRes = await base44.functions.invoke('createHighLevelAppointment', {
        email: data.email,
        name: data.name,
        phone: data.phone,
        tour_date: data.tourDate,
        tour_time: data.tourTime,
        wedding_date: data.weddingDate,
        guest_count: data.guestCount
      });
      console.log('Appointment created:', appointmentRes.data);
    } catch (error) {
      console.error('HighLevel sync error:', error?.response?.data || error?.message || error);
    }

    addBotMessage(`Wonderful! Your tour is scheduled for ${data.tourDate} at ${data.tourTime}. We'll send you a confirmation shortly. Looking forward to meeting you! 🎉`);
  };

  const handlePackageTour = (packageName) => {
    setActiveFlow(null);
    setMessages(prev => [...prev, {
      id: Date.now(),
      text: `Interested in the ${packageName} package`,
      isBot: false
    }]);
    addBotMessage(`Excellent choice! The ${packageName} package is one of our favorites. Let's schedule a tour so you can see everything in person.`);
    setTimeout(() => setActiveFlow('tour'), 1500);
  };

  const closeFlow = () => {
    setActiveFlow(null);
    setPreSelectedDate('');
    addBotMessage("No problem! Is there anything else I can help you with?");
  };

  const handleMeetPlanner = () => {
    const plannerName = firstLookConfig?.host_name || 'the planner';
    setMessages(prev => [...prev, { id: Date.now(), text: `Meet ${plannerName}`, isBot: false }]);
    setUserWantsWelcomeVideo(true);
  };

  const handleSkipVideos = () => {
    setIntroResponded(true);
    setMessages(prev => [...prev, { id: Date.now(), text: "Explore venue tools", isBot: false }]);
    addBotMessage("Perfect! Use the buttons below or just type what you're looking for.");
  };

  const handleBudgetFromVideo = () => {
    setMessages(prev => [...prev, { id: Date.now(), text: "Calculate my budget", isBot: false }]);
    addBotMessage("Let's build your custom budget estimate!");
    setTimeout(() => setActiveFlow('budget'), 1500);
  };

  const handleMiniTourFromVideo = () => {
    setMessages(prev => [...prev, { id: Date.now(), text: "Watch mini tour", isBot: false }]);
    setUserWantsAdditionalVideos(true);
  };

  return {
    messages,
    showGreeting,
    isTyping,
    activeFlow,
    preSelectedDate,
    showTourPrompt,
    introResponded,
    leadName,
    leadEmail,
    leadPhone,
    messagesEndRef,
    chatSessionId,
    handleUserMessage,
    handleQuickAction,
    handleBudgetComplete,
    handleAvailabilityTour,
    handleTourComplete,
    handlePackageTour,
    closeFlow,
    handleMeetPlanner,
    handleSkipVideos,
    handleBudgetFromVideo,
    handleMiniTourFromVideo,
    setShowTourPrompt,
    setActiveFlow,
    requestPlannerHandoff,
  };
}