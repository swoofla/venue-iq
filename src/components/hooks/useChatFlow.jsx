import { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import parseDateFromText from './parseDateFromText';

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

  // Handoff state machine: idle | offered | awaiting_name | awaiting_phone | sending | completed
  const [handoffStage, setHandoffStage] = useState('idle');
  const [handoffTopic, setHandoffTopic] = useState('');
  const [handoffOriginalQuestion, setHandoffOriginalQuestion] = useState('');
  const [handoffTriggered, setHandoffTriggered] = useState(false);

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

  // Trigger the handoff offer — used by LLM detection AND by "Talk to a planner" link
  const offerHandoff = (topicSummary, question) => {
    if (handoffTriggered) {
      addBotMessage(`I already passed your info to ${venue?.head_planner_name || 'our head planner'} — she'll text you on that same thread. Anything else I can help with in the meantime?`);
      return;
    }
    setHandoffTopic(topicSummary);
    setHandoffOriginalQuestion(question);
    setHandoffStage('offered');
  };

  // Public helper used by "Talk to a planner" link
  const requestPlannerHandoff = async () => {
    await ensureChatSession();
    if (handoffTriggered) {
      addBotMessage(`I already passed your info to ${venue?.head_planner_name || 'our head planner'} — she'll text you on that same thread. Anything else I can help with in the meantime?`);
      return;
    }
    // Find most recent user message
    const lastUserMsg = [...messagesRef.current].reverse().find(m => !m.isBot && typeof m.text === 'string');
    const question = lastUserMsg?.text || '(she just wanted to talk to a human)';
    setHandoffTopic('general inquiry');
    setHandoffOriginalQuestion(question);
    setHandoffStage('offered');
    const plannerName = venue?.head_planner_name || 'our head planner';
    addBotMessage(`Of course — want me to have ${plannerName} text you directly? She usually responds within an hour or two.`);
  };

  const sendHandoffRequest = async (finalName, finalPhone) => {
    setHandoffStage('sending');
    const plannerName = venue?.head_planner_name || 'our head planner';
    addBotMessage(`Got it. Sending you a text now from ${plannerName}'s line — check your messages!`);

    const sid = await ensureChatSession();

    try {
      const res = await base44.functions.invoke('createHighLevelLeadAndNotify', {
        venueId,
        chatSessionId: sid,
        leadName: finalName,
        leadPhone: finalPhone,
        leadEmail: leadEmail || user?.email || undefined,
        topicSummary: handoffTopic,
        originalQuestion: handoffOriginalQuestion,
      });

      if (res?.data?.success) {
        setHandoffTriggered(true);
        setHandoffStage('completed');
        addBotMessage(`All set. Anything else I can help with while you wait for ${plannerName}?`);
      } else {
        setHandoffStage('completed');
        addBotMessage(`I had a little trouble reaching ${plannerName} directly, but I've saved your info — someone will follow up within 24 hours.`);
      }
    } catch (err) {
      console.error('Handoff request failed:', err?.message || err);
      setHandoffStage('completed');
      addBotMessage(`I had a little trouble reaching ${plannerName} directly, but I've saved your info — someone will follow up within 24 hours.`);
    }
  };

  const handleHandoffUserInput = (text) => {
    const plannerName = venue?.head_planner_name || 'our head planner';

    if (handoffStage === 'offered') {
      // Expecting yes/no
      const lower = text.toLowerCase();
      const isYes = /\b(yes|yeah|yep|sure|ok|okay|please|y)\b/.test(lower);
      const isNo = /\b(no|nope|nah|not now|maybe later)\b/.test(lower);
      if (isYes) {
        setHandoffStage('awaiting_name');
        addBotMessage(`Perfect. What's your name?`);
      } else if (isNo) {
        setHandoffStage('idle');
        addBotMessage(`No problem — let me know if there's anything else I can help with.`);
      } else {
        addBotMessage(`Just a yes or no — want me to have ${plannerName} text you?`);
      }
      return true;
    }

    if (handoffStage === 'awaiting_name') {
      const trimmed = text.trim();
      if (trimmed.length < 2) {
        addBotMessage(`Could you share your name?`);
        return true;
      }
      setLeadName(trimmed);
      setHandoffStage('awaiting_phone');
      addBotMessage(`Nice to meet you, ${trimmed.split(' ')[0]}. Best number to text you at?`);
      return true;
    }

    if (handoffStage === 'awaiting_phone') {
      const isValid = /^[\d\s\-()+]{10,}$/.test(text.trim());
      if (!isValid) {
        addBotMessage(`Hmm, that doesn't look right — could you include the area code?`);
        return true;
      }
      const cleaned = text.trim();
      setLeadPhone(cleaned);
      sendHandoffRequest(leadName, cleaned);
      return true;
    }

    return false;
  };

  // Find the N nearest available dates to a target date, checking both BookedWeddingDate and BlockedDate
  const findNearestAvailableDates = async (targetDateStr, count = 3) => {
    if (!venueId || !targetDateStr) return [];
    const target = new Date(targetDateStr + 'T00:00:00');
    if (isNaN(target.getTime())) return [];

    // Pull a window of unavailable dates around the target (±120 days)
    const [booked, blocked] = await Promise.all([
      base44.entities.BookedWeddingDate.filter({ venue_id: venueId }),
      base44.entities.BlockedDate.filter({ venue_id: venueId }),
    ]);
    const unavailable = new Set([
      ...booked.map(b => b.date),
      ...blocked.map(b => b.date),
    ]);

    const results = [];
    for (let offset = 1; offset <= 120 && results.length < count; offset++) {
      for (const dir of [1, -1]) {
        const d = new Date(target);
        d.setDate(d.getDate() + offset * dir);
        if (d < new Date(new Date().toDateString())) continue;
        const iso = d.toISOString().slice(0, 10);
        if (!unavailable.has(iso) && !results.includes(iso)) {
          results.push(iso);
          if (results.length >= count) break;
        }
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

    // Active handoff flow handles input first
    if (handoffStage !== 'idle' && handoffStage !== 'completed') {
      const handled = handleHandoffUserInput(text);
      if (handled) return;
    }

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

Extract guest_count: number if mentioned anywhere in recent context, otherwise null.`,
        response_json_schema: {
          type: 'object',
          properties: {
            intent: { type: 'string', enum: ['general', 'date_inquiry', 'tour_interest', 'package_inquiry', 'visual_request'] },
            wedding_date: { type: ['string', 'null'] },
            guest_count: { type: ['number', 'null'] },
          },
          required: ['intent']
        }
      });

      console.log('CLASSIFIER:', JSON.stringify(classifier));

      const intent = classifier?.intent || 'general';
      const guestCount = classifier?.guest_count || null;

      // Deterministic date parsing takes priority over the classifier's wedding_date.
      // Only fall back to the classifier if our parser finds nothing.
      const deterministicDate = parseDateFromText(text);
      const weddingDate = deterministicDate || classifier?.wedding_date || null;
      console.log('[useChatFlow] Date parsing — deterministic:', deterministicDate, '| classifier:', classifier?.wedding_date, '| final:', weddingDate);

      // Persist intent metadata onto the user message (flows through ChatSession sync)
      setMessages(prev => prev.map(m =>
        m.id === userMsgId
          ? { ...m, metadata: { intent, wedding_date: weddingDate, guest_count: guestCount } }
          : m
      ));

      if (guestCount && !leadGuestCountRef.current) leadGuestCountRef.current = guestCount;
      if (weddingDate && !leadWeddingDateRef.current) leadWeddingDateRef.current = weddingDate;

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
      const plannerNameEarly = venue?.head_planner_name || 'Nadine';

      if (intent === 'date_inquiry' && weddingDate) {
        try {
          const [bookedHits, blockedHits] = await Promise.all([
            base44.entities.BookedWeddingDate.filter({ venue_id: venueId, date: weddingDate }),
            base44.entities.BlockedDate.filter({ venue_id: venueId, date: weddingDate }),
          ]);
          const isTaken = (bookedHits?.length || 0) + (blockedHits?.length || 0) > 0;
          const formattedRequested = formatFullDate(weddingDate);
          if (isTaken) {
            const nearest = await findNearestAvailableDates(weddingDate, 3);
            const formattedNearest = nearest.map(formatShortDate);
            availabilityContext = `AVAILABILITY CHECK RESULT: ${weddingDate} is BOOKED. Nearest available: [${nearest.join(', ')}]`;
            verdictSentence = nearest.length > 0
              ? `I'm so sorry — ${formattedRequested} is already booked. The closest open dates are ${formatList(formattedNearest)}.`
              : `I'm so sorry — ${formattedRequested} is already booked.`;
            if (isRapidDateCheck) {
              compactReply = nearest.length > 0
                ? `Unfortunately, ${formattedRequested} is already booked — but ${formatList(formattedNearest)} are open. Any others you'd like to check?`
                : `Unfortunately, ${formattedRequested} is already booked. Any others you'd like to check?`;
            }
          } else {
            availabilityContext = `AVAILABILITY CHECK RESULT: ${weddingDate} is AVAILABLE`;
            verdictSentence = `Good news — ${formattedRequested} is open!`;
            if (isRapidDateCheck) {
              compactReply = `Yes — ${formattedRequested} is open! Any other dates you'd like to check?`;
            }
          }
          const monthNum = parseInt(weddingDate.slice(5, 7), 10);
          const monthName = MONTH_NAMES[monthNum - 1];
          monthContext = `Date month: ${monthName} (apply any seasonal knowledge — e.g. Jan–Mar policy, off-season guest caps).`;
        } catch (err) {
          console.error('Availability check failed:', err?.message || err);
          availabilityContext = `AVAILABILITY CHECK FAILED: do not state whether the date is open or booked. Warmly say you want to double-check that date and offer to have the planner confirm it.`;
          verdictSentence = `I want to double-check that date for you — let me have ${plannerNameEarly} confirm it!`;
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

      const knowledgeContext = venueKnowledge.map(k => `Q: ${k.question}\nA: ${k.answer}`).join('\n\n');
      const plannerName = venue?.head_planner_name || 'Nadine';

      // ── STEP 3: Generate response ───────────────────────────────
      const generator = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a warm, helpful wedding venue chatbot for ${venueName}. Respond conversationally to the bride.

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
${knowledgeContext}

Recent conversation:
${recentHistory}

User's current message: "${text}"

${intent === 'tour_interest' ? 'Give a SHORT warm reply (1-2 sentences) — the tour scheduler will open right after.' : ''}
${intent === 'visual_request' ? 'No photo gallery exists yet. Warmly describe the relevant spaces from the knowledge base and offer a tour to see them in person.' : ''}
${intent === 'date_inquiry' && !weddingDate ? 'Respond naturally and ask which date or timeframe she\'s considering.' : ''}

If the question touches venue-specific policy NOT in the knowledge base, OR topics like fireworks, sparklers, pets, religious customs, dietary restrictions, custom vendor policies, ADA accommodations, drone use, boat/lake access, OR she explicitly asks to talk to a human — set needsHandoff: true with a 2-6 word topicSummary and a warm one-line acknowledgment.`,
        response_json_schema: {
          type: 'object',
          properties: {
            needsHandoff: { type: 'boolean' },
            topicSummary: { type: 'string' },
            acknowledgment: { type: 'string' },
            answer: { type: 'string' }
          },
          required: ['needsHandoff']
        }
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

      if (generator?.needsHandoff && !verdictSentence) {
        const topic = generator.topicSummary || 'your question';
        setHandoffTopic(topic);
        setHandoffOriginalQuestion(text);
        setHandoffStage('offered');
      }

      setMessages(prev => [...prev, { id: Date.now(), text: answer, isBot: true }]);

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
        offerHandoff('general inquiry', '(she just wanted to talk to a human)');
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