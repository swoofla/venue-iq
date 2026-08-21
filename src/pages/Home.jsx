import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { useVenue } from '@/lib/VenueContext';

import { createPageUrl } from '../utils';
import useChatFlow from '../components/hooks/useChatFlow';

import ChatMessage from '@/components/chat/ChatMessage';
import ChatVideoMessage from '@/components/chat/ChatVideoMessage';
import HandoffContactCard from '@/components/chat/HandoffContactCard';
import TypingIndicator from '@/components/chat/TypingIndicator';
import ChatInput from '@/components/chat/ChatInput';
import ChatEmptyState from '@/components/chat/ChatEmptyState';
import VenuePickerScreen from '@/components/chat/VenuePickerScreen';
import EnhancedBudgetCalculator from '@/components/flows/EnhancedBudgetCalculator';
import AvailabilityChecker from '@/components/flows/AvailabilityChecker';
import TourScheduler from '@/components/flows/TourScheduler';
import PackagesView from '@/components/flows/PackagesView';
import VenueGallery from '@/components/flows/VenueGallery';
import VenueVisualizer from '@/components/flows/VenueVisualizer';
import DebugTraceButton from '@/components/chat/DebugTraceButton';
import MessageFeedback from '@/components/chat/MessageFeedback';
import { Toaster } from 'sonner';

// How long a closed chat transcript is kept on this device before we discard it
// and start fresh. Change here to adjust the persistence window.
const CHAT_TTL_MS = 24 * 60 * 60 * 1000;

export default function Home() {
  const [user, setUser] = useState(null);
  const [venueId, setVenueId] = useState(null);
  const [venueSlug, setVenueSlug] = useState(null); // resolved slug used for the per-tenant storage key
  const [venueName, setVenueName] = useState('');
  const [loading, setLoading] = useState(true);
  const [venueNotFound, setVenueNotFound] = useState(false);
  const [missingSlug, setMissingSlug] = useState(false); // no ?venue= at all, vs. a slug that didn't match
  const [venueChoices, setVenueChoices] = useState(null); // set when a picker is needed
  const [noVenueAssigned, setNoVenueAssigned] = useState(false);

  const navigate = useNavigate();
  // Venue resolution and the auth check race to clear `loading`. If venue
  // wins, the chatbot paints for a frame before navigate() fires. This lets
  // the venue branch know a redirect is coming and hold the spinner.
  const authRedirectingRef = React.useRef(false);

  // Auth from context, resolved above page level. Home's own auth chain runs
  // in parallel and races venue resolution; the picker decision cannot depend
  // on that race, so it reads the provider instead.
  const { isAdmin: ctxIsAdmin, userLoading: ctxUserLoading } = useVenue();

  // The effect below is keyed on ctxUserLoading so it re-runs once auth
  // resolves. This ref keeps the body to a single execution.
  const resolveStartedRef = React.useRef(false);

  useEffect(() => {
    // Wait for the provider to know whether this is an admin. Deciding earlier
    // would show the neutral screen to an admin who should get the picker.
    if (ctxUserLoading || resolveStartedRef.current) return;
    resolveStartedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const slugFromUrl = params.get('venue');
    const isEmbedded = window.self !== window.top || params.get('embed') === '1';

    base44.entities.Venue.list().then(venues => {
      // No single-venue fallback. It resolved a bare URL to whichever venue
      // happened to exist, which served one venue's planner from the neutral
      // app domain and silently masked a missing ?venue= slug in any embed.
      // A slug is now required, always.
      const matched = slugFromUrl
        ? (venues.find(v => v.slug === slugFromUrl) || null)
        : null;
      if (matched) {
        setVenueId(matched.id);
        setVenueSlug(matched.slug || matched.id);
        setVenueName(matched.name);
      } else if (!slugFromUrl && !isEmbedded && ctxIsAdmin) {
        // Admin-only convenience for previewing without typing a slug.
        setVenueChoices(venues);
      } else {
        if (!slugFromUrl) {
          console.warn('[Home] No ?venue= slug. An embed must always include it.');
          setMissingSlug(true);
        }
        setVenueNotFound(true);
      }
      // Hold the spinner if the auth branch is redirecting to the dashboard.
      if (!authRedirectingRef.current) setLoading(false);
    });

    base44.auth.isAuthenticated().then(isAuth => {
      if (isAuth) {
        base44.auth.me().then(u => {
          setUser(u);

          // Never redirect inside the embed. This page is the bride-facing
          // chatbot on the venue's own website; a logged-in owner viewing it
          // there must stay in the chat.
          if (isEmbedded) {
            setLoading(false);
            return;
          }

          const isStaff = u.role === 'admin' || u.role === 'venue_owner' || u.role === 'venue_staff';

          if (u.role === 'admin' || u.venue_id) {
            // Claim the redirect before navigating, so a venue-resolution
            // callback that lands in between does not clear the spinner and
            // paint the chatbot for a frame.
            authRedirectingRef.current = true;
            // navigate() instead of window.location.href — a full page load
            // re-boots the app and re-runs auth, which is the flash owners
            // see on login.
            navigate(createPageUrl('Dashboard'), { replace: true });
            return;
          }

          if (isStaff && !u.venue_id) {
            // Previously fell through to the chatbot with no explanation.
            console.warn('[Home] Staff user has no venue_id assigned:', u.email);
            setNoVenueAssigned(true);
          }

          setLoading(false);
        }).catch(err => {
          // auth.me() can reject independently of isAuthenticated(). Without
          // this the spinner strands permanently.
          console.warn('[Home] Failed to load user, continuing as anonymous:', err?.message || err);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    }).catch(err => {
      // Never strand the spinner. An auth failure means treat them as a
      // visitor and show the chatbot.
      console.warn('[Home] Auth check failed, continuing as anonymous:', err?.message || err);
      setLoading(false);
    });
  }, [ctxUserLoading, ctxIsAdmin, navigate]);

  const { data: venue } = useQuery({
    queryKey: ['venue', venueId],
    queryFn: () => venueId ? base44.entities.Venue.get(venueId) : null,
    enabled: !!venueId
  });

  const { data: bookedDates = [] } = useQuery({
    queryKey: ['bookedDates'],
    queryFn: () => base44.entities.BookedWeddingDate.list(),
  });

  // Scoped to this venue. Previously unscoped, which would have served every
  // venue's knowledge to every venue's chatbot the moment a second venue
  // existed. Key matches what VenueSettings invalidates so dashboard
  // approvals reach the live chat.
  const { data: venueKnowledge = [] } = useQuery({
    queryKey: ['knowledge-active', venueId],
    queryFn: () => venueId ? base44.entities.VenueKnowledge.filter({ venue_id: venueId, is_active: true }) : [],
    enabled: !!venueId
  });

  const { data: firstLookConfig } = useQuery({
    queryKey: ['firstLookConfig', venueId],
    queryFn: async () => {
      if (!venueId) return null;
      const configs = await base44.entities.FirstLookConfiguration.filter({ venue_id: venueId });
      return configs[0] || null;
    },
    enabled: !!venueId
  });

  const chat = useChatFlow({
    venueId,
    venueName,
    venue,
    user,
    bookedDates,
    venueKnowledge,
    firstLookConfig,
  });

  const handleTalkToPlanner = () => {
    chat.requestPlannerHandoff();
  };

  // ── Client-side chat persistence ──────────────────────────────────────
  // Persist the transcript across closing/reopening the embedded widget so the
  // bride doesn't lose context. Pure localStorage; no server-side state added.
  // Per-venue key so tenants never collide. activeFlow is intentionally NOT
  // persisted — flow components hold their own internal state, so a restored
  // half-finished flow would be broken.
  const chatStorageKey = (venueSlug || venueId) ? `viq_chat_v1_${venueSlug || venueId}` : null;
  const restoreAttemptedRef = React.useRef(false);

  // RESTORE on load — runs once, after the venue is resolved and the key is known.
  useEffect(() => {
    if (loading || !chatStorageKey || restoreAttemptedRef.current) return;
    restoreAttemptedRef.current = true;
    try {
      const raw = window.localStorage.getItem(chatStorageKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      const fresh =
        saved &&
        typeof saved.savedAt === 'number' &&
        Array.isArray(saved.messages) &&
        (Date.now() - saved.savedAt) < CHAT_TTL_MS;
      if (!fresh) {
        try { window.localStorage.removeItem(chatStorageKey); } catch { /* ignore */ }
        return;
      }
      if (saved.messages.length > 0) {
        chat.setMessages(saved.messages);
        // Suppress the opening sequence — user is mid-conversation, not new.
        chat.setShowGreeting(false);
      }
      if (saved.lead && typeof saved.lead === 'object') {
        if (typeof saved.lead.name === 'string') chat.setLeadName(saved.lead.name);
        if (typeof saved.lead.email === 'string') chat.setLeadEmail(saved.lead.email);
        if (typeof saved.lead.phone === 'string') chat.setLeadPhone(saved.lead.phone);
      }
    } catch {
      // Storage unavailable / malformed JSON — fall through to fresh start.
      try { window.localStorage.removeItem(chatStorageKey); } catch { /* ignore */ }
    }
  }, [loading, chatStorageKey, chat]);

  // SAVE on change — write the transcript whenever it changes (and when lead
  // info changes). Never overwrites a saved chat with an empty array during load.
  useEffect(() => {
    if (loading || !chatStorageKey) return;
    if (!chat.messages || chat.messages.length === 0) return;
    try {
      const payload = {
        savedAt: Date.now(),
        messages: chat.messages,
        lead: {
          name: chat.leadName || '',
          email: chat.leadEmail || '',
          phone: chat.leadPhone || '',
        },
      };
      window.localStorage.setItem(chatStorageKey, JSON.stringify(payload));
    } catch {
      // Storage full / unavailable — chat continues working, just won't persist.
    }
  }, [loading, chatStorageKey, chat.messages, chat.leadName, chat.leadEmail, chat.leadPhone]);

  // Pre-load an initial message from ?message= once the chatbot is ready.
  // Runs exactly once per page load — guarded so navigations or re-renders don't resend it.
  const initialMessageSentRef = React.useRef(false);
  useEffect(() => {
    if (loading || !venueId || initialMessageSentRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const initialMessage = params.get('message');
    if (initialMessage && initialMessage.trim()) {
      initialMessageSentRef.current = true;
      chat.handleUserMessage(initialMessage.trim());
    }
  }, [loading, venueId, chat]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (noVenueAssigned) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-stone-50">
        <div className="text-center max-w-sm">
          <h1 className="text-lg font-semibold text-stone-900 mb-2">No venue assigned yet</h1>
          <p className="text-sm text-stone-600">
            Your account isn't linked to a venue. Ask whoever invited you to assign one,
            and then refresh this page.
          </p>
        </div>
      </div>
    );
  }

  if (venueChoices) {
    return (
      <VenuePickerScreen
        venues={venueChoices}
        onSelect={(v) => {
          setVenueId(v.id);
          setVenueSlug(v.slug || v.id);
          setVenueName(v.name);
          setVenueChoices(null);
        }}
      />
    );
  }

  // No ?venue= slug at all — a different situation from a slug that didn't
  // match, so it gets its own copy and a way back to the dashboard.
  if (venueNotFound && missingSlug) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-stone-50">
        <div className="text-center max-w-sm">
          <h1 className="text-lg font-semibold text-stone-900 mb-2">No venue specified</h1>
          <p className="text-sm text-stone-600">
            This link is missing a venue. If you are a venue owner, sign in to reach your dashboard.
          </p>
          <Link
            to={createPageUrl('Dashboard')}
            className="inline-block mt-4 text-sm font-medium text-stone-900 underline hover:no-underline"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (venueNotFound) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center text-stone-600">
        We couldn't load this venue's planner. Please check the link and try again.
      </div>
    );
  }

  const showEmptyState = chat.messages.length === 0 && !chat.activeFlow && !chat.isTyping;
  const debugMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';

  return (
    <div className="h-[100dvh] bg-stone-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-black text-white px-6 py-3 flex-shrink-0">
        {/* Host site draws its own floating close button in the top-right on phones —
            reserve 64px there so it never overlaps the "Book a tour" button. */}
        <div className="max-w-4xl mx-auto flex items-center justify-between pr-16 min-[769px]:pr-0">
          <div>
            <h1 style={{ fontSize: '15px', fontWeight: 500 }}>{venueName}</h1>
            <p
              style={{
                fontSize: '10px',
                letterSpacing: '0.2em',
                color: 'rgba(255,255,255,0.55)',
                marginTop: '2px',
              }}
            >
              VIRTUAL PLANNER
            </p>
          </div>
          <button
            onClick={() => chat.setActiveFlow('tour')}
            className="bg-white text-black rounded-full hover:bg-stone-100 transition-colors whitespace-nowrap flex-shrink-0"
            style={{
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            Book a tour
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-4xl w-full mx-auto bg-white shadow-sm min-h-0">
        {/* Messages - scrollable area (self-contained; never scrolls the host page) */}
        <div
          ref={chat.messagesContainerRef}
          className="flex-1 overflow-y-auto p-6 pb-4 min-h-0 flex flex-col overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {showEmptyState ? (
            <ChatEmptyState venueName={venueName} />
          ) : (
            <>
              {chat.messages.map((message) => (
                <React.Fragment key={message.id}>
                  {message.isVideo ? (
                    <ChatVideoMessage
                      videoId={message.videoId}
                      label={message.videoLabel}
                      aspectRatio={message.aspectRatio}
                    />
                  ) : message.isHandoffCard ? (
                    <HandoffContactCard
                      plannerName={venue?.planner_name || 'our planner'}
                      topicSummary={message.topicSummary}
                      originalQuestion={message.originalQuestion}
                      venueId={venueId}
                      chatSessionId={chat.chatSessionId}
                    />
                  ) : (
                    <>
                      <ChatMessage
                        message={message.text}
                        isBot={message.isBot}
                      />
                      {message.isBot && message.text && !message.isHandoffCard && !message.isVideo && (
                        <MessageFeedback onSubmit={(args) => chat.submitMessageFeedback({ ...args, messageId: message.id })} />
                      )}
                    </>
                  )}
                </React.Fragment>
              ))}

              {chat.isTyping && <TypingIndicator />}

              {/* Tour Prompt Quick Replies */}
              {chat.showTourPrompt && (
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => {
                      chat.setShowTourPrompt(false);
                      chat.handleUserMessage("Schedule a tour");
                    }}
                    className="flex-1 px-4 py-3 bg-black text-white rounded-full hover:bg-stone-800 transition-colors text-sm font-medium"
                  >
                    Schedule a tour
                  </button>
                  <button
                    onClick={() => {
                      chat.setShowTourPrompt(false);
                      chat.handleUserMessage("Maybe later");
                    }}
                    className="flex-1 px-4 py-3 bg-stone-100 text-stone-700 rounded-full hover:bg-stone-200 transition-colors text-sm font-medium"
                  >
                    Maybe later
                  </button>
                </div>
              )}

              {/* Active Flow Components */}
              {chat.activeFlow === 'budget' && venueId && (
                <EnhancedBudgetCalculator
                  venueId={venueId}
                  onComplete={chat.handleBudgetComplete}
                  onCancel={chat.closeFlow}
                />
              )}

              {chat.activeFlow === 'availability' && (
                <AvailabilityChecker
                  bookedDates={bookedDates}
                  onScheduleTour={chat.handleAvailabilityTour}
                  onCancel={chat.closeFlow}
                />
              )}

              {chat.activeFlow === 'tour' && (
                <TourScheduler
                  preSelectedDate={chat.preSelectedDate}
                  venue={venue}
                  prefillContact={chat.leadName && chat.leadEmail ? {
                    name: chat.leadName,
                    email: chat.leadEmail,
                    phone: chat.leadPhone
                  } : null}
                  onComplete={chat.handleTourComplete}
                  onCancel={chat.closeFlow}
                />
              )}

              {chat.activeFlow === 'packages' && venueId && (
                <PackagesView
                  venueId={venueId}
                  onScheduleTour={chat.handlePackageTour}
                  onCancel={chat.closeFlow}
                />
              )}

              {chat.activeFlow === 'gallery' && venueId && (
                <VenueGallery
                  venueId={venueId}
                  onScheduleTour={() => {
                    chat.setActiveFlow('tour');
                  }}
                  onCancel={chat.closeFlow}
                />
              )}

              {chat.activeFlow === 'visualizer' && venueId && (
                <VenueVisualizer
                  venueId={venueId}
                  venueName={venueName}
                  onComplete={() => {
                    chat.setActiveFlow('tour');
                  }}
                  onCancel={chat.closeFlow}
                />
              )}

            </>
          )}
        </div>

        {/* Chat Input */}
        <ChatInput
          onSend={chat.handleUserMessage}
          disabled={chat.isTyping || chat.activeFlow !== null}
          placeholder="Ask any question here"
        />

        {/* Disclaimer + Talk to a planner */}
        <div className="px-4 pb-3 bg-white">
          <p
            className="text-center text-stone-400"
            style={{ fontSize: '10px', marginTop: '8px' }}
          >
            {venueName}'s virtual planner can make mistakes. Confirm details on your tour.
          </p>
          <button
            type="button"
            onClick={handleTalkToPlanner}
            className="text-stone-500 hover:underline mt-2"
            style={{ fontSize: '11px', cursor: 'pointer' }}
          >
            Talk to a planner
          </button>
        </div>
      </main>
      {debugMode && <DebugTraceButton traceRef={chat.debugTraceRef} />}
      <Toaster position="top-center" richColors />
    </div>
  );
}