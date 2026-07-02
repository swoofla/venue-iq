import { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import parseDateFromText from './parseDateFromText';
import parseDatesFromText from './parseDatesFromText';
import { partsFromIso, formatFullDate, formatShortDate, formatList, ordinal, detectBareDay, getMajorityMonth, distinctMonths, matchAmbiguityAnswer, DAY_NAMES, MONTH_NAMES } from './dateHelpers';
import { buildClassifierPrompt, CLASSIFIER_SCHEMA } from './buildClassifierPrompt';
import { buildGeneratorPrompt } from './buildGeneratorPrompt';

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
  const currentTopicRef = useRef(null);   // last non-general classifier.topic
  const pendingActionRef = useRef(null);  // 'awaiting_quote_details' | null
  const currentYearRef = useRef(null);    // last wedding year she stated/used (number)
  const currentWeekdayRef = useRef(null); // last stated_weekday she gave ('Saturday', etc.)
  const currentMonthRef = useRef(null);   // last month (1-12) she stated/used

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
  const offerHandoff = (topicSummary, originalQuestion) => {
    const plannerName = venue?.planner_name || 'our planner';
    setHandoffPending({ topicSummary: topicSummary || 'general inquiry', originalQuestion: originalQuestion || 'Requested to speak with a planner' });
    addBotMessage(`Of course — want me to have ${plannerName} text you directly? She usually responds within an hour or two.`);
  };

  // Public helper used by "Talk to a planner" link
  const requestPlannerHandoff = async () => {
    await ensureChatSession();
    offerHandoff('general inquiry');
  };

  // Store tester feedback on a specific bot message. Bundles the full debug trace and
  // transcript so a thumbs-down is fully diagnosable from a single record.
  const submitMessageFeedback = async ({ messageId, rating, comment }) => {
    try {
      const sid = chatSessionIdRef.current || (await ensureChatSession());
      const msgs = messagesRef.current;
      const idx = msgs.findIndex(m => m.id === messageId);
      const flaggedMessage = idx >= 0 ? (msgs[idx].text || '') : '';
      let precedingUser = '';
      for (let i = idx - 1; i >= 0; i--) {
        if (!msgs[i].isBot && typeof msgs[i].text === 'string') { precedingUser = msgs[i].text; break; }
      }
      const transcript = msgs
        .filter(m => !m.isVideo && typeof m.text === 'string')
        .map(m => ({ role: m.isBot ? 'bot' : 'user', content: m.text }));
      // NOTE: ChatFeedback schema declares transcript and debug_trace as objects (dicts),
      // not arrays — sending arrays directly fails create with a validation error.
      // Wrap each in a small object so they round-trip cleanly through the schema.
      console.log('[Feedback] Submitting:', { venue_id: venueId, rating, hasSession: !!sid });
      const created = await base44.entities.ChatFeedback.create({
        venue_id: venueId,
        chat_session_id: sid || undefined,
        rating,
        comment: comment || undefined,
        flagged_message: flaggedMessage,
        preceding_user_message: precedingUser,
        transcript: { messages: transcript },
        debug_trace: { turns: debugTraceRef.current },
      });
      console.log('[Feedback] Created record:', created?.id, created);
      // On a thumbs-down, auto-create a ClickUp debug task. Fire-and-forget —
      // a ClickUp failure must never break feedback submission.
      if (rating === 'down') {
        base44.functions.invoke('createClickUpTask', {
          comment: comment || '',
          flagged_message: flaggedMessage || '',
          preceding_user_message: precedingUser || '',
          chat_session_id: sid || '',
          venue_id: venueId || '',
          feedback_id: created?.id || '',
        }).catch(err => console.error('ClickUp task creation failed:', err?.message || err));
      }
      return true;
    } catch (err) {
      console.error('Feedback submit failed:', err?.message || err);
      return false;
    }
  };

  // Append an inline contact-card message and the warm "drop your info" lead-in.
  const appendHandoffCard = (topicSummary, originalQuestion) => {
    const plannerName = venue?.planner_name || 'our planner';
    setMessages(prev => [
      ...prev,
      { id: Date.now(), text: `Perfect — drop your name and number below and ${plannerName} will text you!`, isBot: true },
      { id: Date.now() + 1, isBot: true, isHandoffCard: true, topicSummary: topicSummary || 'general inquiry', originalQuestion: originalQuestion || topicSummary || 'general inquiry' },
    ]);
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

      const classifier = await base44.integrations.Core.InvokeLLM({
        prompt: buildClassifierPrompt({
          text,
          today,
          tz,
          recentHistory,
          plannerNameForClassifier,
          handoffPending,
          currentTopic: currentTopicRef.current,
          pendingAction: pendingActionRef.current,
          knownGuestCount: leadGuestCountRef.current,
          knownYear: currentYearRef.current,
          knownDate: leadWeddingDateRef.current,
        }),
        response_json_schema: CLASSIFIER_SCHEMA,
        model: 'claude_opus_4_8'
      });

      console.log('CLASSIFIER:', JSON.stringify(classifier));

      // Handoff acceptance: append inline card, clear pending, stop here.
      if (handoffPending && classifier?.handoff_response === 'accepted') {
        const topic = handoffPending.topicSummary;
        const originalQuestion = handoffPending.originalQuestion;
        setHandoffPending(null);
        setIsTyping(false);
        appendHandoffCard(topic, originalQuestion);
        return;
      }
      // Any non-accepted message clears the pending offer; conversation continues normally.
      if (handoffPending) setHandoffPending(null);

      const intent = classifier?.intent || 'general';
      if (classifier?.topic && classifier.topic !== 'general') currentTopicRef.current = classifier.topic;
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
      const resolvedYear = (Number.isInteger(classifier?.year) ? classifier.year : null) || (weddingDate ? partsFromIso(weddingDate).y : null);
      if (resolvedYear) currentYearRef.current = resolvedYear;
      // Carry-forward continuity: persist weekday and month whenever she states them,
      // so a bare follow-up like "July" can inherit weekday="Saturday" from earlier.
      if (statedWeekday) currentWeekdayRef.current = statedWeekday;
      const resolvedMonth = (Number.isInteger(classifier?.month) ? classifier.month : null) || (weddingDate ? partsFromIso(weddingDate).m : null);
      if (resolvedMonth) currentMonthRef.current = resolvedMonth;

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
      let priceAfterAvailability = false; // she confirmed an open date mid price-request → price it this turn
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

      // ── Month-level availability: "what Saturdays are open in October?" ──
      // Fires when she asks about availability for a month/timeframe but gave no
      // specific day. Fully deterministic — never reaches the generator.
      //
      // Carry-forward: month / year / stated_weekday can all be inherited from
      // earlier turns via currentMonthRef / currentYearRef / currentWeekdayRef.
      // A bare "July" turn after "Saturdays in June" + "2027" inherits weekday
      // = "Saturday" and year = 2027 from those earlier turns.
      //
      // The month-openings check ALWAYS runs when intent=date_inquiry and we
      // know month + year — even with no weekday filter (we pass all 7 days).
      // This guarantees date-availability questions NEVER fall through to the
      // generator with availability: null.
      {
        const monthFromTurn = Number.isInteger(classifier?.month) ? classifier.month : null;
        const inheritedMonth = monthFromTurn || currentMonthRef.current || null;
        const targetYear = (Number.isInteger(classifier?.year) ? classifier.year : null) || currentYearRef.current || null;
        const inheritedWeekday = statedWeekday || currentWeekdayRef.current || null;

        if (
          intent === 'date_inquiry' &&
          !weddingDate &&
          weddingDates.length === 0 &&
          !yearMissing &&
          Number.isInteger(inheritedMonth) && inheritedMonth >= 1 && inheritedMonth <= 12 &&
          targetYear
        ) {
          const month = inheritedMonth;
          let weekdays;
          if (inheritedWeekday) {
            weekdays = [DAY_NAMES.indexOf(inheritedWeekday)];
          } else if (/\bweekend?s?\b/i.test(text)) {
            weekdays = [0, 6];
          } else {
            // No weekday filter → list ALL openings in the month.
            weekdays = [0, 1, 2, 3, 4, 5, 6];
          }

          try {
            const repDate = `${targetYear}-${String(month).padStart(2, '0')}-01`;
            const res = await base44.functions.invoke('checkDateAvailability', {
              venueId, date: repDate, mode: 'monthOpenings', weekdays, monthOpeningsLimit: 12,
            });
            const open = Array.isArray(res?.data?.monthOpenDates) ? res.data.monthOpenDates : [];
            const total = res?.data?.count ?? open.length;
            const monthName = MONTH_NAMES[month - 1];
            const dayLabel = inheritedWeekday
              ? `${inheritedWeekday}s`
              : (weekdays.length === 2 ? 'weekend dates' : 'open dates');

            let monthReply;
            if (open.length === 0) {
              monthReply = `It looks like our ${dayLabel} in ${monthName} ${targetYear} are all booked. Want me to check another month?`;
            } else {
              const shown = open.slice(0, 5).map(formatShortDate);
              const more = total > shown.length ? `, plus a few more` : '';
              monthReply = `Here are the open ${dayLabel} in ${monthName} ${targetYear} — ${formatList(shown)}${more}. Want me to look at a specific one, or another month?`;
            }

            lastMultiMonthRef.current = { month, year: targetYear };
            open.forEach(d => checkedDatesRef.current.add(d));

            setIsTyping(false);
            setMessages(prev => [...prev, { id: Date.now(), text: monthReply, isBot: true }]);
            debugTraceRef.current.push({
              userMessage: text, classifier, retrieval: null,
              dateResolution: {
                parseDateFromText: deterministicDate,
                ambiguityResolvedIso,
                weddingDate,
                inheritedMonth, inheritedYear: targetYear, inheritedWeekday,
                availability: { mode: 'monthOpenings', month, year: targetYear, weekdays, open, total },
              },
              responseMode: 'month-openings (JS)', generatorPrompt: null, generatorOutput: null, finalReply: monthReply,
            });
            return;
          } catch (err) {
            console.error('Month-openings check failed:', err?.message || err);
            // Fall through to normal handling on error.
          }
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
            // If an earlier turn asked her for a date/guest to quote and we haven't delivered the
            // price yet, she picked this date to GET that price — so confirm it's open AND price it
            // in the same reply, instead of dead-ending on a bare "still open".
            priceAfterAvailability = pendingActionRef.current === 'awaiting_quote_details';
            if (alreadyChecked) {
              verdictSentence = `Right — ${formattedRequested}, and it's open.`;
            } else {
              verdictSentence = `${pastHeadsUp}Good news — ${formattedRequested} is open!`;
            }
            if (isRapidDateCheck && !priceAfterAvailability) {
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

      if ((intent === 'package_inquiry' || priceAfterAvailability) && venueId) {
        const pkgs = await base44.entities.VenuePackage.filter({ venue_id: venueId, is_active: true });
        packageContext = 'ACTIVE PACKAGES:\n' + pkgs
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
          .map(p => `- ${p.name} — $${p.price?.toLocaleString?.() || p.price} (up to ${p.max_guests} guests)\n  ${p.description || ''}\n  Includes: ${(p.includes || []).join('; ')}`)
          .join('\n\n');
      }

      // ── Topic-focused knowledge assembly ─────────────────────────
      const topic = priceAfterAvailability ? 'packages_pricing' : (classifier?.topic || 'general');
      const formatEntry = (k) => `Q: ${k.question}\nA: ${k.answer}`;
      const primaryEntries = venueKnowledge.filter(k => k.topic === topic && topic !== 'general');
      const generalBaseline = venueKnowledge.filter(k => k.topic === 'general');
      const capacityRelevantTopics = ['packages_pricing', 'availability_dates'];
      const capacityEntries = (capacityRelevantTopics.includes(topic) && topic !== 'capacity_guests')
        ? venueKnowledge.filter(k => k.topic === 'capacity_guests')
        : [];
      const matchCount = primaryEntries.length;
      console.log('TOPIC:', topic, '| entries matched:', matchCount);

      let knowledgeContext;
      if (matchCount === 0) {
        // Migration safety: if no entries are tagged for this topic, fall back to all.
        knowledgeContext = venueKnowledge.map(formatEntry).join('\n\n');
      } else {
        const primaryBlock = `=== EVERYTHING ${venueName.toUpperCase()} KNOWS ABOUT ${topic.toUpperCase().replace(/_/g, ' ')} ===\n${primaryEntries.map(formatEntry).join('\n\n')}`;
        const capacityBlock = capacityEntries.length > 0
          ? `\n\n=== CAPACITY & GUEST LIMITS (always applies) ===\n${capacityEntries.map(formatEntry).join('\n\n')}`
          : '';
        const generalBlock = generalBaseline.length > 0
          ? `\n\n=== GENERAL VENUE KNOWLEDGE (baseline) ===\n${generalBaseline.map(formatEntry).join('\n\n')}`
          : '';
        knowledgeContext = primaryBlock + capacityBlock + generalBlock;
      }

      const plannerName = venue?.planner_name || 'our planner';
      const plannerTitle = venue?.planner_title || 'our planner';

      // ── STEP 3: Generate response ───────────────────────────────
      const knownBlock = `KNOWN ABOUT THIS BRIDE SO FAR (use it; ask only for what's missing):
- Guest count: ${leadGuestCountRef.current ?? 'not provided yet'}
- Wedding date: ${leadWeddingDateRef.current ? formatFullDate(leadWeddingDateRef.current) : 'not provided yet'}
- Year of interest: ${currentYearRef.current ?? 'not provided yet'}
${pendingActionRef.current === 'awaiting_quote_details' ? '- You previously asked for her date and/or guest count to give a price. If you now have her guest count above, give the specific price now — do not ask for it again.' : ''}
`;

      const generatorPrompt = buildGeneratorPrompt({
        venueName,
        plannerName,
        plannerTitle,
        verdictSentence,
        priceAfterAvailability,
        intent,
        availabilityContext,
        monthContext,
        packageContext,
        knowledgeContext,
        knownBlock,
        recentHistory,
        text,
        weddingDate,
      });

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

      if (intent === 'package_inquiry' || priceAfterAvailability) {
        pendingActionRef.current = leadGuestCountRef.current ? null : 'awaiting_quote_details';
      }

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
        setHandoffPending({ topicSummary: topic, originalQuestion: text });
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
        // Budget calculator temporarily disabled pending rebuild (vendor pricing changed).
        // Re-enable: restore the two commented lines below and the "Calculate my budget" CTA.
        // setMessages(prev => [...prev, { id: Date.now(), text: "I'd like to use the budget calculator", isBot: false }]);
        // setTimeout(() => setActiveFlow('budget'), 1500);
        break;
      case 'availability':
        setMessages(prev => [...prev, { id: Date.now(), text: "I want to check date availability", isBot: false }]);
        addBotMessage("Great choice! Let's see if your dream date is available. Please select a date from the calendar below.");
        setTimeout(() => setActiveFlow('availability'), 1500);
        break;
      case 'tour':
        setMessages(prev => [...prev, { id: Date.now(), text: "I'd like to schedule a tour", isBot: false }]);
        addBotMessage(`Wonderful! We'd love to welcome you to ${venueName} and show you around in person. Let's find a time that works best for you.`);
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

    const submissionData = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      wedding_date: data.weddingDate,
      guest_count: parseInt(data.guestCount) || null,
      tour_date: data.tourDate,
      tour_time: data.tourTime,
      source: 'tour_scheduler',
      venue_id: venueId,
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

  // Budget calculator temporarily disabled pending rebuild (vendor pricing changed).
  // Re-enable: restore the body below and re-add the "Calculate my budget" CTA in the First Look video component.
  const handleBudgetFromVideo = () => {};

  const handleMiniTourFromVideo = () => {
    setMessages(prev => [...prev, { id: Date.now(), text: "Watch mini tour", isBot: false }]);
    setUserWantsAdditionalVideos(true);
  };

  return {
    messages,
    setMessages,
    showGreeting,
    setShowGreeting,
    isTyping,
    activeFlow,
    preSelectedDate,
    showTourPrompt,
    introResponded,
    leadName,
    setLeadName,
    leadEmail,
    setLeadEmail,
    leadPhone,
    setLeadPhone,
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
    submitMessageFeedback,
    debugTraceRef,
  };
}