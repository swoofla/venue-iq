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

  // ── Debug trace (observability only — does NOT affect chatbot behavior) ──
  // One entry pushed per user turn capturing the full internal decision path.
  // Exposed via the hook and exported by a ?debug=1-gated button in the UI.
  const debugTraceRef = useRef([]);

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

Extract wedding_date — be careful and precise:
- Resolve to YYYY-MM-DD when the bride gives an exact day she is asking about.
- ALWAYS preserve a year she states, regardless of word order or phrasing. "2027 Saturday October 22", "October 22 2027", "10/22/27", "next fall 2027", "fall of 2027 on October 22" all mean the year 2027. NEVER override or "correct" a stated year — even if it conflicts with a weekday she mentions, even if it seems unusual.
- If she gives a month and day but NO year at all (e.g. "October 17th", "10/17"), do NOT guess and do NOT resolve to the next future occurrence. Return wedding_date as null and set year_missing: true, and return month (1-12) and day (1-31) so we can ask her for the year.
- If she only mentions a month, season, or vague timeframe with no specific day ("next fall", "summer", "October"), return wedding_date null and year_missing false.
- Use today's date only to choose the future occurrence when she gives a day-of-month and an explicit year both — never to fill in a missing year.

Extract stated_weekday — the literal weekday word she wrote ("Saturday", "Sunday", "Friday", "Monday", "Tuesday", "Wednesday", "Thursday"), case-normalized. If she did not name a weekday, return null. Do NOT compute it from the date. Just capture the word she used.

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
            year_missing: { type: ['boolean', 'null'] },
            month: { type: ['number', 'null'] },
            day: { type: ['number', 'null'] },
            stated_weekday: { type: ['string', 'null'], enum: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday', null] },
            guest_count: { type: ['number', 'null'] },
            handoff_response: { type: ['string', 'null'], enum: ['accepted', 'declined', 'unrelated', null] },
          },
          required: ['intent']
        },
        model: 'claude_opus_4_8'
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
      // pendingDayAmbiguityRef can hold one of three shapes:
      //   1. { day, candidates: [{month,year}, ...] }     — old "May or June 28th?"
      //   2. { kind: 'year_missing', month, day }         — "what year?"
      //   3. { kind: 'weekday_conflict', isoDate,
      //        statedWeekday, alternateIso }              — "Friday or Saturday?"
      let ambiguityResolvedIso = null;
      if (pendingDayAmbiguityRef.current) {
        const pending = pendingDayAmbiguityRef.current;

        if (pending.kind === 'year_missing') {
          // Look for a 4-digit year, then a 2-digit year (e.g. "27").
          const m4 = text.match(/\b(20\d{2})\b/);
          const m2 = !m4 ? text.match(/\b(\d{2})\b/) : null;
          const year = m4 ? parseInt(m4[1], 10) : (m2 ? 2000 + parseInt(m2[1], 10) : null);
          if (year) {
            const candidate = new Date(year, pending.month - 1, pending.day);
            if (candidate.getMonth() === pending.month - 1 && candidate.getDate() === pending.day) {
              const y = candidate.getFullYear();
              const mm = String(candidate.getMonth() + 1).padStart(2, '0');
              const dd = String(candidate.getDate()).padStart(2, '0');
              ambiguityResolvedIso = `${y}-${mm}-${dd}`;
            }
            pendingDayAmbiguityRef.current = null;
          }
          // No year detected → leave pending, let normal flow handle the message.
        } else if (pending.kind === 'weekday_conflict') {
          // She picked: either go with the actual weekday of the original date,
          // or shift to the nearest date matching her stated weekday.
          const lower = text.toLowerCase();
          const wantsStated = new RegExp(`\\b${pending.statedWeekday.toLowerCase()}\\b`).test(lower);
          const acceptsActual = /\b(yes|yep|yeah|sure|ok|okay|that(?:'s| is)? fine|works|sounds good|the )/i.test(lower)
            && !wantsStated;
          if (wantsStated) {
            ambiguityResolvedIso = pending.alternateIso;
            pendingDayAmbiguityRef.current = null;
          } else if (acceptsActual) {
            ambiguityResolvedIso = pending.isoDate;
            pendingDayAmbiguityRef.current = null;
          }
          // Otherwise: leave pending, fall through to normal classification.
        } else {
          // Legacy shape: { day, candidates }
          const { day, candidates } = pending;
          const picked = matchAmbiguityAnswer(text, candidates);
          if (picked) {
            const candidate = new Date(picked.year, picked.month - 1, day);
            if (candidate.getMonth() === picked.month - 1 && candidate.getDate() === day) {
              const y = candidate.getFullYear();
              const mm = String(candidate.getMonth() + 1).padStart(2, '0');
              const dd = String(candidate.getDate()).padStart(2, '0');
              ambiguityResolvedIso = `${y}-${mm}-${dd}`;
            }
            pendingDayAmbiguityRef.current = null;
          }
          // If she didn't pick a candidate, leave pending in place; the parsers run normally.
        }
      }

      // Date extraction — CLASSIFIER IS AUTHORITATIVE.
      // The Opus classifier (above) preserves a stated year in any phrasing and
      // captures stated_weekday. We use its wedding_date / wedding_dates first.
      // The deterministic regex parser is only a FALLBACK when the classifier
      // returned nothing — it drops stated years in unsupported word orders and
      // must not override the classifier when both produce a result.
      const dateContext = buildDateContext();
      const isoRe = /^\d{4}-\d{2}-\d{2}$/;
      const classifierDateRaw = typeof classifier?.wedding_date === 'string' && isoRe.test(classifier.wedding_date)
        ? classifier.wedding_date
        : null;
      const classifierDates = Array.isArray(classifier?.wedding_dates)
        ? classifier.wedding_dates.filter(d => typeof d === 'string' && isoRe.test(d))
        : [];
      const deterministicDates = parseDatesFromText(text, dateContext);
      const deterministicDate = parseDateFromText(text, dateContext);

      let weddingDates = [];
      if (!ambiguityResolvedIso) {
        if (classifierDates.length > 1) {
          weddingDates = classifierDates;
        } else if (deterministicDates.length > 1) {
          weddingDates = deterministicDates;
        }
      }
      weddingDates = weddingDates.slice(0, 5); // cap at 5 per spec

      const weddingDate = ambiguityResolvedIso
        || classifierDateRaw
        || (weddingDates[0] || null)
        || deterministicDate;
      const statedWeekday = typeof classifier?.stated_weekday === 'string' ? classifier.stated_weekday : null;
      const yearMissing = classifier?.year_missing === true
        && !weddingDate
        && weddingDates.length === 0
        && Number.isInteger(classifier?.month)
        && Number.isInteger(classifier?.day);
      console.log('[useChatFlow] Date parsing — ambiguityResolved:', ambiguityResolvedIso, '| classifier:', classifierDateRaw, classifierDates, '| classifier year_missing:', classifier?.year_missing, classifier?.month, classifier?.day, '| classifier weekday:', statedWeekday, '| deterministicDate:', deterministicDate, '| deterministicDates:', deterministicDates, '| final single:', weddingDate, '| final multi:', weddingDates, '| focus:', userFocusDateRef.current, '| multiMonth:', lastMultiMonthRef.current);

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
            debugTraceRef.current.push({
              userMessage: text,
              classifier,
              retrieval: null,
              dateResolution: { parseDateFromText: deterministicDate, ambiguityResolvedIso, weddingDate, availability: null },
              responseMode: 'clarity question',
              generatorPrompt: null,
              generatorOutput: null,
              finalReply: reprompt,
            });
            return;
          }
          // No prior multi-month list to draw from → ask freely.
          const reprompt2 = `Which month — the ${bareDay}${ordinal(bareDay)} of which month?`;
          setIsTyping(false);
          setMessages(prev => [...prev, { id: Date.now(), text: reprompt2, isBot: true }]);
          debugTraceRef.current.push({
            userMessage: text,
            classifier,
            retrieval: null,
            dateResolution: { parseDateFromText: deterministicDate, ambiguityResolvedIso, weddingDate, availability: null },
            responseMode: 'clarity question',
            generatorPrompt: null,
            generatorOutput: null,
            finalReply: reprompt2,
          });
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

      // ── Guard A: missing year ───────────────────────────────────
      // She gave a month + day but no year. Do NOT call checkDateAvailability
      // and do NOT guess. Ask which year, stash month/day so her reply resolves.
      if (intent === 'date_inquiry' && yearMissing) {
        pendingDayAmbiguityRef.current = {
          kind: 'year_missing',
          month: classifier.month,
          day: classifier.day,
        };
        const yearReprompt = "Got it — and what year are you looking at?";
        setIsTyping(false);
        setMessages(prev => [...prev, { id: Date.now(), text: yearReprompt, isBot: true }]);
        debugTraceRef.current.push({
          userMessage: text,
          classifier,
          retrieval: null,
          dateResolution: { parseDateFromText: deterministicDate, ambiguityResolvedIso, weddingDate, availability: null },
          responseMode: 'clarity question',
          generatorPrompt: null,
          generatorOutput: null,
          finalReply: yearReprompt,
        });
        return;
      }

      // ── Guard B: weekday conflict ───────────────────────────────
      // She named a weekday AND we have a resolved date. If they don't match,
      // ask one clarity question with the nearest correct-weekday date.
      // Deterministic: we compute the actual weekday from the resolved ISO date.
      if (intent === 'date_inquiry' && weddingDate && statedWeekday) {
        const { jsDate: weddingJs } = partsFromIso(weddingDate);
        const actualWeekday = DAY_NAMES[weddingJs.getDay()];
        if (actualWeekday !== statedWeekday) {
          const statedIdx = DAY_NAMES.indexOf(statedWeekday);
          // Nearest date to weddingDate whose weekday is statedWeekday.
          // Day-of-week difference (signed, in -3..+3) — pick the shorter direction.
          const diff = ((statedIdx - weddingJs.getDay()) + 7) % 7; // 0..6
          const offset = diff <= 3 ? diff : diff - 7; // -3..+3, never 0 here
          const alt = new Date(weddingJs);
          alt.setDate(alt.getDate() + offset);
          const altY = alt.getFullYear();
          const altM = String(alt.getMonth() + 1).padStart(2, '0');
          const altD = String(alt.getDate()).padStart(2, '0');
          const alternateIso = `${altY}-${altM}-${altD}`;

          pendingDayAmbiguityRef.current = {
            kind: 'weekday_conflict',
            isoDate: weddingDate,
            statedWeekday,
            alternateIso,
          };

          // Alternate: drop the duplicated weekday since "{statedWeekday}, ..." already says it.
          // formatFullDate -> "Saturday, October 23, 2027"; strip the leading weekday + comma.
          const altFull = formatFullDate(alternateIso);
          const altWithoutWeekday = altFull.replace(/^[^,]+,\s*/, '');
          const askedFormatted = formatFullDate(weddingDate);
          const weekdayReprompt = `It looks like ${askedFormatted} is actually a ${actualWeekday} — are you okay with a ${actualWeekday}, or did you mean ${statedWeekday}, ${altWithoutWeekday}?`;
          setIsTyping(false);
          setMessages(prev => [...prev, { id: Date.now(), text: weekdayReprompt, isBot: true }]);
          debugTraceRef.current.push({
            userMessage: text,
            classifier,
            retrieval: null,
            dateResolution: { parseDateFromText: deterministicDate, ambiguityResolvedIso, weddingDate, availability: null },
            responseMode: 'clarity question',
            generatorPrompt: null,
            generatorOutput: null,
            finalReply: weekdayReprompt,
          });
          return;
        }
      }

      // ── STEP 2: Route by intent ─────────────────────────────────
      let availabilityContext = '';
      let packageContext = '';
      let monthContext = '';
      let verdictSentence = '';
      let compactReply = '';
      let availResult = null; // debug-trace only: { date, isAvailable, alternatives, error? } | null
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
          availResult = { dates: results };
          setIsTyping(false);
          setMessages(prev => [...prev, { id: Date.now(), text: multiReply, isBot: true }]);
          debugTraceRef.current.push({
            userMessage: text,
            classifier,
            retrieval: null,
            dateResolution: {
              parseDateFromText: deterministicDate,
              ambiguityResolvedIso,
              weddingDate,
              availability: availResult,
            },
            responseMode: 'multi-date (JS)',
            generatorPrompt: null,
            generatorOutput: null,
            finalReply: multiReply,
          });
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
          availResult = {
            date: effectiveDate,
            isAvailable: availData.isAvailable !== false,
            alternatives: Array.isArray(availData.alternatives) ? availData.alternatives : [],
          };
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
          availResult = { date: effectiveDate, error: err?.message || String(err) };
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
        debugTraceRef.current.push({
          userMessage: text,
          classifier,
          retrieval: null,
          dateResolution: { parseDateFromText: deterministicDate, ambiguityResolvedIso, weddingDate, availability: availResult },
          responseMode: 'rapid-check (JS)',
          generatorPrompt: null,
          generatorOutput: null,
          finalReply: compactReply,
        });
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
      const generatorPrompt = `You are the virtual wedding planner for ${venueName}. You speak with brides and couples who are exploring the venue on its website. You are an AI assistant presented as the venue's "virtual planner" — you are not a specific human, and you never claim to be ${plannerName} or any other staff member.

# Your mission
Help each bride genuinely explore ${venueName} and figure out for herself whether it's the right fit for her wedding. You are a warm, knowledgeable planner guiding her thinking — not a salesperson, and not a funnel. Many brides arrive busy, overwhelmed, or early in planning, so make every answer easy to take in.

# What you know — and what you don't
- Answer only from the venue knowledge provided to you in each message. That knowledge is your single source of truth for facts.
- Never invent or estimate venue specifics — prices, policies, dates, capacities, names, addresses, counts, inclusions. If a detail is not in the knowledge you were given, you do not know it, and you must not make it up. A made-up fact can mislead a bride and damage the venue's credibility.
- If you genuinely don't have something, it is fine to say so plainly. (See "Bringing in ${plannerName}" for when a real person should step in versus when you should simply answer or acknowledge a gap.)

# How to think
These two habits matter as much as the facts.

**Ask, don't assume.** If you need a specific detail to answer accurately — a year, a guest count, an exact date, a season — and she hasn't given it, ask one short question for it before answering or looking anything up. Example: she says "September 25th" with no year, you reply "Got it — and what year are you looking at?" Don't guess.

**Ask for clarity when something doesn't add up.** If a detail she gives conflicts with what you can work out — for example, she says "Saturday, October 22, 2027" but that date is actually a Friday — don't silently override her and don't guess. Name the discrepancy and ask one short question to resolve it: "It looks like October 22, 2027 is actually a Friday — are you okay with a Friday, or did you mean Saturday the 23rd?" Always clear up confusion before giving information that might be wrong.

**Stay on the goal.** Track what she is ultimately trying to figure out across the whole conversation, not just her latest message.
- If you offered to do something once you had a detail ("I can give you the exact price once I know your date") and you now have that detail, follow through and deliver it. Never leave a promise hanging.
- When a side task is resolved — like confirming a date is open — return to the original goal (the price for that date) rather than looping on the side task ("want to check another date?"). Continue the side task only if she asks you to.
- Use everything she has already told you. If she's established a Saturday in 2027, quote the Saturday-2027 price directly; don't fall back to a range she has to re-narrow.
- Don't repeat yourself. Assume she remembers what you just told her — if you've already described the packages or the inclusions, don't re-list them when a related question comes up. Move forward instead. For example, if she's just seen the package list and then asks the cost, give the pricing and ask what you still need to quote it (her date and guest count), not the package list all over again.

# How to answer
- Answer fully and directly using what's in the provided knowledge. Don't hold detail back to offer "more later."
- Only offer to elaborate on something if that detail is actually present in the knowledge you were given — scan it first. If the knowledge is just names or a short list with no descriptions, share what you have; don't promise descriptions you don't have. If you make an offer and she accepts, you must be able to deliver real specifics.
- Be honest about fit. When the truthful answer is that something may not match what she wants (for example, she wants 60 guests to stay on-site but the property sleeps about 26), say so kindly. That honesty is what earns her trust and helps her decide well.

# How to close
End almost every answer with ONE warm, forward-looking question — the kind a thoughtful planner asks to help her clarify her vision or see whether the venue fits. The strongest questions connect what you just told her to her own plans, and tend to probe the things that decide fit: guest count, date or season, the feeling or style she wants, and what matters most to her.
- Never offer to re-explain what you just covered ("want me to tell you more about the cabins?"). That's a dead end. Move the conversation forward instead.
- One question at a time — never a stack of questions, and never anything that feels like a form.
- Use judgment. If she's clearly grabbing a quick fact or signaling she's done, answer warmly and leave space rather than forcing a question.
- Never end with a sales pitch. You are not a salesperson and you never push a tour or a booking. The "Book a tour" button is always visible for her to use whenever she's ready. Bring up scheduling a tour only if she raises visiting, scheduling, or booking herself, or if she seems stuck or overwhelmed and a real person would genuinely help.

# What to learn first: her date and guest count
Two things anchor almost everything about a wedding here — her date (the year and the calendar date) and her guest count. They drive pricing, which packages fit, capacity, and availability, so an accurate quote is impossible without them.

Treat learning these two as your quiet early objective. Work them into your forward questions near the start of the conversation — ahead of softer vision or style questions, and ahead of giving any precise quote. It's fine to ask for both together since they're a natural pair ("Do you have a rough guest count and a date in mind?"), but keep it light: a real planner's curiosity, never an interrogation, a form, or a demand. Once you know her date and guest count, use them in every answer so your pricing and suggestions are specific to her wedding rather than generic.

# Bringing in ${plannerName}
${plannerName}, our ${plannerTitle}, can step in by reaching out to the bride directly. Offer this only when it's truly warranted:
- She seems stuck or overwhelmed and a person would genuinely help, or
- She's asking about something reserved for a human: capacity exceptions, contract / deposit / refund discussions, coordinating a specific outside vendor, or an emotionally sensitive situation.

Do NOT offer ${plannerName} as a way to cover a basic information gap. If it's an ordinary question you simply weren't given the answer to, either answer it from your knowledge or acknowledge plainly that you don't have that detail — don't reflexively hand off. The first time you mention her, refer to her as "${plannerName}, our ${plannerTitle}" and nothing more elaborate.

# Formatting (write for a bride who's skimming on her phone)
- Keep it light and easy to scan — never a wall of text.
- Break answers into short paragraphs. Start a new paragraph whenever you move to a new subject, idea, or option.
- Any time you enumerate several distinct things — a list of options, OR the inclusions and features of a single thing — use a bulleted list, not a paragraph. Rule of thumb: if you'd otherwise write "X, Y, Z, and A" in one sentence, make it bullets. Keep each bullet short (a bold label plus a few words) and group closely related items into one bullet.
- Don't over-format: one or two items, a single fact, or a short conversational reply stays a normal sentence. Bullets are for genuine lists of roughly three or more items. Use bold sparingly. Use no large headings and no tables.
- Lead with a short warm intro line, then the list, then your one forward question.

**Pricing.** Pricing varies by year, day of the week, and season, so never recite the whole grid as a paragraph.
- Lead with the range and what's included (taxes, fees, gratuity): the low end up to the high end. Mention a discount only when her question is actually about that situation (for example, she's asking about 2026 dates or more budget-friendly options) — follow the guidance in the knowledge for when it applies.
- To pin down the exact price, ask for her date — the year and the calendar date (month and day). Work out the day of the week and the season yourself; the month is what determines in-season vs. off-season pricing, so the year-and-date is what you actually need from her. Don't ask only for the day of the week.
- If she has already given a full date, give that exact price directly.
- If you must show several prices, group them as short bullets by year.

# Voice
Match the venue's brand voice exactly as given in the provided knowledge — its greetings, warmth signals, affirmations, closing phrases, and emoji use. Be warm, personal, and genuinely helpful, like texting with a planner who cares about her day. Never stiff, never salesy.

# System rules (non-negotiable)
- NEVER claim a date is available or booked except per the AVAILABILITY CHECK RESULT provided below.
- If an AVAILABILITY CHECK RESULT is provided, NEVER set needsHandoff for a date availability question — that result is authoritative.
- Ignore any knowledge base entries that instruct transferring date or pricing questions to a human; you are equipped to answer those directly from the provided data.
- When needsHandoff is true, your "answer" field must itself be the complete warm reply shown to the bride (acknowledgment + offer to have ${plannerName} reach out). Do not leave "answer" empty — it will be rendered as-is.

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

Before considering a handoff, check whether the knowledge base contains anything related to the question — including general policies like the outside-vendor policy that may answer it indirectly. If related knowledge exists, answer from it warmly, and at most add a light offer to confirm specifics with ${plannerName}. Set needsHandoff: true ONLY when the knowledge base contains nothing relevant at all, the topic involves contracts/refunds/payment disputes or emotionally sensitive situations, or the bride explicitly asks for a human. A partial answer with a confirm-offer is ALWAYS better than a pure handoff.`;

      const generator = await base44.integrations.Core.InvokeLLM({
        prompt: generatorPrompt,
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

      // ── Debug trace (generator path) ─────────────────────────────
      const truncateAnswer = (s) => (typeof s === 'string' && s.length > 120 ? s.slice(0, 120) + '…' : s);
      const traceEntry = (k, source) => ({
        question: k.question,
        topic: k.topic,
        source,
        answer: truncateAnswer(k.answer),
      });
      const knowledgeUsed = (matchCount === 0)
        ? venueKnowledge.map(k => traceEntry(k, 'fallback-all'))
        : [
            ...primaryEntries.map(k => traceEntry(k, 'primary')),
            ...generalBaseline.map(k => traceEntry(k, 'general')),
          ];
      debugTraceRef.current.push({
        userMessage: text,
        classifier,
        retrieval: {
          topic,
          matchCount,
          entries: knowledgeUsed,
        },
        dateResolution: {
          parseDateFromText: deterministicDate,
          ambiguityResolvedIso,
          weddingDate,
          availability: availResult,
        },
        responseMode: 'generator',
        generatorPrompt,
        generatorOutput: generator,
        finalReply: answer,
      });

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
      const errReply = "Thanks for reaching out! What would you like to know more about?";
      setMessages(prev => [...prev, { id: Date.now(), text: errReply, isBot: true }]);
      debugTraceRef.current.push({
        userMessage: text,
        classifier: null,
        retrieval: null,
        dateResolution: null,
        responseMode: 'error',
        generatorPrompt: null,
        generatorOutput: null,
        finalReply: errReply,
        error: error?.message || String(error),
      });
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
    debugTraceRef,
  };
}