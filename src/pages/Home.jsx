import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

import { createPageUrl } from '../utils';
import useChatFlow from '../components/hooks/useChatFlow';

import ChatMessage from '@/components/chat/ChatMessage';
import ChatVideoMessage from '@/components/chat/ChatVideoMessage';
import HandoffContactCard from '@/components/chat/HandoffContactCard';
import TypingIndicator from '@/components/chat/TypingIndicator';
import ChatInput from '@/components/chat/ChatInput';
import ChatEmptyState from '@/components/chat/ChatEmptyState';
import EnhancedBudgetCalculator from '@/components/flows/EnhancedBudgetCalculator';
import AvailabilityChecker from '@/components/flows/AvailabilityChecker';
import TourScheduler from '@/components/flows/TourScheduler';
import PackagesView from '@/components/flows/PackagesView';
import VenueGallery from '@/components/flows/VenueGallery';
import VenueVisualizer from '@/components/flows/VenueVisualizer';
import DebugTraceButton from '@/components/chat/DebugTraceButton';
import MessageFeedback from '@/components/chat/MessageFeedback';
import { Toaster } from 'sonner';

export default function Home() {
  const [user, setUser] = useState(null);
  const [venueId, setVenueId] = useState(null);
  const [venueName, setVenueName] = useState('Sugar Lake Weddings');
  const [loading, setLoading] = useState(true);
  const [venueNotFound, setVenueNotFound] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const venueSlug = params.get('venue');
    const isEmbedded = window.self !== window.top || params.get('embed') === '1';

    base44.entities.Venue.list().then(venues => {
      const matched = venueSlug ? venues.find(v => v.slug === venueSlug) : null;
      if (matched) {
        setVenueId(matched.id);
        setVenueName(matched.name);
      } else {
        setVenueNotFound(true);
      }
      setLoading(false);
    });

    base44.auth.isAuthenticated().then(isAuth => {
      if (isAuth) {
        base44.auth.me().then(u => {
          setUser(u);
          // Admins and users with venue assignments go to Dashboard
          if (u.role === 'admin' || u.venue_id) {
            if (!isEmbedded) {
              window.location.href = createPageUrl('Dashboard');
              return;
            } else {
              setLoading(false);
            }
          }
          // Anyone else can see the chatbot
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });
  }, []);

  const { data: venue } = useQuery({
    queryKey: ['venue', venueId],
    queryFn: () => venueId ? base44.entities.Venue.get(venueId) : null,
    enabled: !!venueId
  });

  const { data: bookedDates = [] } = useQuery({
    queryKey: ['bookedDates'],
    queryFn: () => base44.entities.BookedWeddingDate.list(),
  });

  const { data: venueKnowledge = [] } = useQuery({
    queryKey: ['venueKnowledge'],
    queryFn: () => base44.entities.VenueKnowledge.filter({ is_active: true }),
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

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
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
        <div className="max-w-4xl mx-auto flex items-center justify-between">
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
              PLAN YOUR WEDDING
            </p>
          </div>
          <button
            onClick={() => chat.setActiveFlow('tour')}
            className="bg-white text-black rounded-full hover:bg-stone-100 transition-colors"
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
        {/* Messages - scrollable area */}
        <div
          className="flex-1 overflow-y-auto p-6 pb-4 min-h-0 flex flex-col"
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

              <div ref={chat.messagesEndRef} />
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