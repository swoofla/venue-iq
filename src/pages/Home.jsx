import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';

import { createPageUrl } from '../utils';
import useChatFlow from '../components/hooks/useChatFlow';

import ChatMessage from '@/components/chat/ChatMessage';
import ChatVideoMessage from '@/components/chat/ChatVideoMessage';
import TypingIndicator from '@/components/chat/TypingIndicator';
import QuickActions from '@/components/chat/QuickActions';
import ChatInput from '@/components/chat/ChatInput';
import EnhancedBudgetCalculator from '@/components/flows/EnhancedBudgetCalculator';
import AvailabilityChecker from '@/components/flows/AvailabilityChecker';
import TourScheduler from '@/components/flows/TourScheduler';
import PackagesView from '@/components/flows/PackagesView';
import VenueGallery from '@/components/flows/VenueGallery';
import VenueVisualizer from '@/components/flows/VenueVisualizer';

export default function Home() {
  const [user, setUser] = useState(null);
  const [venueId, setVenueId] = useState(null);
  const [venueName, setVenueName] = useState('Sugar Lake Weddings');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Venue.list().then(venues => {
      const sugarLakeVenue = venues.find(v => v.name.toLowerCase().includes('sugar lake')) || venues[0];
      if (sugarLakeVenue) {
        setVenueId(sugarLakeVenue.id);
        setVenueName(sugarLakeVenue.name);
      }
    });

    base44.auth.isAuthenticated().then(isAuth => {
      if (isAuth) {
        base44.auth.me().then(u => {
          setUser(u);
          if (u.venue_id) {
            window.location.href = createPageUrl('Dashboard');
            return;
          } else {
            setLoading(false);
          }
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

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="h-[100dvh] bg-stone-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-black text-white px-6 py-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-light tracking-wide">{venueName}</h1>
            <p className="text-xs tracking-[0.3em] text-stone-400 mt-0.5">VIRTUAL PLANNER</p>
          </div>
          <a
            href={`sms:${venue?.phone || '+12166161598'}`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white text-xs font-medium tracking-wide border border-white/20"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Text Us
          </a>
        </div>
      </header>

      {/* ─── FIX #2: Added min-h-0 to main + messages div, and WebkitOverflowScrolling ─── */}
      <main className="flex-1 flex flex-col max-w-4xl w-full mx-auto bg-white shadow-sm min-h-0">
        {/* Messages - scrollable area */}
        <div 
          className="flex-1 overflow-y-auto p-6 pb-4 min-h-0"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {chat.messages.map((message) => (
            <React.Fragment key={message.id}>
              {message.isVideo ? (
                <ChatVideoMessage
                  videoId={message.videoId}
                  label={message.videoLabel}
                  aspectRatio={message.aspectRatio}
                />
              ) : (
                <ChatMessage
                  message={message.text}
                  isBot={message.isBot}
                />
              )}
              {/* Show "Meet Your Planner" buttons */}
              {message.showMeetPlannerButtons && (
                <div className="flex gap-2 mb-4 ml-10">
                  <button
                    onClick={chat.handleMeetPlanner}
                    className="px-4 py-2.5 bg-black text-white text-sm rounded-full font-medium hover:bg-stone-800 transition-colors"
                  >
                    Meet {firstLookConfig?.host_name || 'our planner'}
                  </button>
                  <button
                    onClick={chat.handleSkipVideos}
                    className="px-4 py-2.5 bg-stone-100 text-stone-600 text-sm rounded-full font-medium hover:bg-stone-200 transition-colors"
                  >
                    Use planning tools
                  </button>
                </div>
              )}
              {/* Show post-video options */}
              {message.showPostVideoOptions && (
                <div className="flex gap-2 mb-4 ml-10">
                  <button
                    onClick={chat.handleBudgetFromVideo}
                    className="px-4 py-2.5 bg-black text-white text-sm rounded-full font-medium hover:bg-stone-800 transition-colors"
                  >
                    💰 Calculate my budget
                  </button>
                  <button
                    onClick={chat.handleMiniTourFromVideo}
                    className="px-4 py-2.5 bg-stone-100 text-stone-600 text-sm rounded-full font-medium hover:bg-stone-200 transition-colors"
                  >
                    🎥 Watch mini tour
                  </button>
                </div>
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
        </div>

        {/* Quick Actions */}
        {chat.introResponded && (
          <QuickActions
            onAction={chat.handleQuickAction}
            disabled={chat.isTyping || chat.activeFlow !== null}
          />
        )}

        {/* Chat Input */}
        <ChatInput
          onSend={chat.handleUserMessage}
          disabled={chat.isTyping || chat.activeFlow !== null}
          placeholder="Ask me your wedding questions.."
        />
      </main>
    </div>
  );
}