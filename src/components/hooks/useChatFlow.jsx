import { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

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

  const handleUserMessage = async (text) => {
    setShowGreeting(false);

    // Ensure session exists on first message
    await ensureChatSession();

    // If this is the first message, inject the bot's opening question before the user message
    const isFirstMessage = messages.length === 0;
    setMessages(prev => {
      const next = [...prev];
      if (isFirstMessage) {
        next.push({
          id: Date.now() - 1,
          text: `Hey! I'm ${venueName}'s virtual planner. I'd love to help you figure out if we're the right fit. To start, what date are you thinking — or are you still picking?`,
          isBot: true,
        });
      }
      next.push({ id: Date.now(), text, isBot: false });
      return next;
    });

    // Active handoff flow handles input first
    if (handoffStage !== 'idle' && handoffStage !== 'completed') {
      const handled = handleHandoffUserInput(text);
      if (handled) return;
    }

    const lowerText = text.toLowerCase();

    if (lowerText.includes('budget') || lowerText.includes('cost') || lowerText.includes('price')) {
      addBotMessage("Great question! Let me help you figure out the perfect package for your budget. I'll walk you through our budget calculator.");
      setTimeout(() => setActiveFlow('budget'), 1500);
    } else if (lowerText.includes('available') || lowerText.includes('date') || lowerText.includes('book')) {
      addBotMessage("Let's check if your desired date is available! Please select a date below.");
      setTimeout(() => setActiveFlow('availability'), 1500);
    } else if (lowerText.includes('tour') || lowerText.includes('visit') || lowerText.includes('see')) {
      addBotMessage("We'd love to show you around Sugar Lake! Let's schedule a tour that works for you.");
      setTimeout(() => setActiveFlow('tour'), 1500);
    } else if (lowerText.includes('package') || lowerText.includes('option')) {
      addBotMessage("We have three beautiful packages designed to fit different wedding styles and sizes. Take a look:");
      setTimeout(() => setActiveFlow('packages'), 1500);
    } else if (lowerText.includes('photo') || lowerText.includes('picture') ||
               lowerText.includes('gallery') || lowerText.includes('look like') ||
               lowerText.includes('see the venue') || lowerText.includes('show me')) {
      addBotMessage("Let me show you around! Here are some photos of our beautiful venue.");
      setTimeout(() => setActiveFlow('gallery'), 1500);
    } else if (lowerText.includes('visualize') || lowerText.includes('design') ||
               lowerText.includes('see my wedding') || lowerText.includes('what would it look like') ||
               lowerText.includes('decorate') || lowerText.includes('style')) {
      addBotMessage("Let me show you what your wedding could look like at our venue! ✨");
      setTimeout(() => setActiveFlow('visualizer'), 1500);
    } else if (lowerText.includes('video') || lowerText.includes('watch') ||
               lowerText.includes('first look') || lowerText.includes('virtual tour')) {
      if (firstLookConfig?.welcome_video_id) {
        addBotMessage("Here's a quick video tour of our venue! 🎥");
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: Date.now(),
            isBot: true,
            isVideo: true,
            videoId: firstLookConfig.welcome_video_id,
            videoLabel: `Welcome to ${venueName}`,
            aspectRatio: 'portrait'
          }]);
        }, 1000);
      } else {
        addBotMessage("Let me show you around with some photos!");
        setTimeout(() => setActiveFlow('gallery'), 1500);
      }
    } else {
      // Try local knowledge match first
      const relevantKnowledge = venueKnowledge.find(k =>
        lowerText.includes(k.question.toLowerCase()) ||
        k.question.toLowerCase().includes(lowerText)
      );

      if (relevantKnowledge) {
        addBotMessage(relevantKnowledge.answer);
      } else {
        setIsTyping(true);
        try {
          const knowledgeContext = venueKnowledge.map(k => `Q: ${k.question}\nA: ${k.answer}`).join('\n\n');

          const llmResult = await base44.integrations.Core.InvokeLLM({
            prompt: `You are a warm, helpful wedding venue chatbot assistant for ${venueName}. You have access to a knowledge base of venue-specific Q&A.

If you can confidently answer the question from the venue knowledge base provided, do so warmly and conversationally. If the question requires venue-specific policy not in the knowledge base, OR it touches any of these topics — fireworks, sparklers, pets, religious customs, dietary restrictions, custom vendor policies, ADA accommodations, alcohol or bar policy, noise ordinances, overnight stays, drone use, boat or lake access — OR the bride explicitly asks to talk to a human, respond by setting needsHandoff: true with a 2-6 word topicSummary and a warm one-line acknowledgment that thanks her for the question.

Do NOT guess at venue policy. Better to escalate than to misinform.

Venue Knowledge Base:
${knowledgeContext}

User Question: ${text}`,
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

          if (llmResult?.needsHandoff) {
            const topic = llmResult.topicSummary || 'your question';
            const ack = llmResult.acknowledgment || 'Thanks for asking!';
            const plannerName = venue?.head_planner_name || 'our head planner';
            setHandoffTopic(topic);
            setHandoffOriginalQuestion(text);
            setHandoffStage('offered');
            addBotMessageImmediate(`${ack} Want me to have ${plannerName} text you? She usually responds within an hour or two.`);
          } else {
            const answer = llmResult?.answer || "Thanks for reaching out! I can help with budget planning, date availability, scheduling a tour, or exploring our packages. What would you like to know more about?";
            setMessages(prev => [...prev, { id: Date.now(), text: answer, isBot: true }]);
          }
        } catch (error) {
          console.error('AI response error:', error?.message || error);
          setIsTyping(false);
          setMessages(prev => [...prev, { id: Date.now(), text: "Thank you for reaching out! I can help you with budget planning, checking date availability, scheduling a tour, or exploring our packages. What would you like to know more about?", isBot: true }]);
        }
        return;
      }
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