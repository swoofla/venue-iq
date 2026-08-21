import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Calendar, Home, Settings, BookOpen, Package, Copy, Check, Mail, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { format, addDays, startOfMonth, endOfMonth } from 'date-fns';
import VenueAnalytics from '@/components/dashboard/VenueAnalytics';
import IndustryBenchmarks from '@/components/dashboard/IndustryBenchmarks';
import SourceBreakdown from '@/components/dashboard/SourceBreakdown';
import ChatSessionAnalytics from '@/components/dashboard/ChatSessionAnalytics';
import DateRangeFilter, { computePresetRange } from '@/components/dashboard/DateRangeFilter';
import VenueSelector from '@/components/admin/VenueSelector';
import OnboardingReadiness from '@/components/dashboard/OnboardingReadiness';
import VenueOnboardingWizard from '@/components/admin/VenueOnboardingWizard';
import CalendarConnectionHealth from '@/components/dashboard/CalendarConnectionHealth';
import { useVenue } from '@/lib/VenueContext';

const APP_VERSION = '1.2.0';

export default function Dashboard() {
  // Venue selection now lives in VenueContext so it survives navigation.
  // Previously this was local state and reset on every route change.
  const { user, venueId, setVenueId, venues, isAdmin, userLoading } = useVenue();
  const [copied, setCopied] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  // Which readiness-checklist row was clicked, so the wizard can open on the
  // step that fills that gap instead of always starting at step one.
  const [onboardingTopic, setOnboardingTopic] = useState(null);
  const [datePreset, setDatePreset] = useState('30');
  const [dateRange, setDateRange] = useState(() => computePresetRange('30'));

  const { data: venue } = useQuery({
    queryKey: ['venue', venueId],
    queryFn: () => venueId ? base44.asServiceRole.entities.Venue.get(venueId) : null,
    enabled: !!venueId
  });

  const { data: weddings = [] } = useQuery({
    queryKey: ['weddings', venueId],
    queryFn: () => venueId ? base44.asServiceRole.entities.BookedWeddingDate.filter({ venue_id: venueId }) : [],
    enabled: !!venueId
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ['submissions', venueId],
    queryFn: () => venueId ? base44.asServiceRole.entities.ContactSubmission.filter({ venue_id: venueId }) : [],
    enabled: !!venueId
  });

  const { data: packages = [] } = useQuery({
    queryKey: ['packages', venueId],
    queryFn: () => venueId ? base44.asServiceRole.entities.VenuePackage.filter({ venue_id: venueId }) : [],
    enabled: !!venueId
  });

  if (userLoading || !user) {
    return <div className="py-12 text-center">Loading...</div>;
  }

  if (!venueId) {
    if (user.role === 'admin' && !user.venue_id) {
      return <VenueSelector user={user} onVenueSelected={setVenueId} />;
    }
    return (
      <div className="text-center max-w-md mx-auto py-12">
        <h2 className="text-2xl font-bold mb-4">No Venue Assigned</h2>
        <p className="text-stone-600">Your account hasn't been assigned to a venue yet. Please contact your administrator.</p>
      </div>
    );
  }

  // Venue admins (have venue_id) can view their dashboard

  const now = new Date();
  const next30Days = addDays(now, 30);
  const upcomingWeddings = weddings.filter(w => {
    const weddingDate = new Date(w.date);
    return weddingDate >= now && weddingDate <= next30Days;
  });

  const currentYear = now.getFullYear();
  const yearWeddings = weddings.filter(w => new Date(w.date).getFullYear() === currentYear);

  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const monthWeddings = weddings.filter(w => {
    const weddingDate = new Date(w.date);
    return weddingDate >= monthStart && weddingDate <= monthEnd;
  });

  const handleCopyVenueUrl = () => {
    const venueUrl = window.location.origin;
    navigator.clipboard.writeText(venueUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="space-y-8">
        {/* Page-level actions. The venue name, page title and Log out all live
            in the shell header now — only these two belong to the page. */}
        <div className="flex items-center justify-end gap-3">
          {venue && (
            <Button
              onClick={handleCopyVenueUrl}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Venue URL
                </>
              )}
            </Button>
          )}
          <a
            href="mailto:support@idealbrides.co"
            className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900 transition-colors"
          >
            <Mail className="w-4 h-4" />
            Contact Support
          </a>
        </div>

        {user.role === 'admin' && !user.venue_id && <VenueSelector user={user} onVenueSelected={setVenueId} />}
        
        {/* Onboarding Readiness */}
        {!showOnboarding && (
          <OnboardingReadiness
            venueId={venueId}
            onStartOnboarding={(topic) => {
              setOnboardingTopic(topic || null);
              setShowOnboarding(true);
            }}
          />
        )}

        {showOnboarding && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Train Your AI Concierge</h2>
              <Button variant="ghost" size="sm" onClick={() => { setShowOnboarding(false); setOnboardingTopic(null); }}>
                ← Back to Dashboard
              </Button>
            </div>
            <VenueOnboardingWizard
              venueId={venueId}
              initialTopic={onboardingTopic}
              onComplete={() => {
                setShowOnboarding(false);
                setOnboardingTopic(null);
              }}
            />
          </div>
        )}
        
        {/* Quick Stats */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white border border-stone-200 rounded-xl p-6">
            <div className="text-stone-600 text-sm mb-1">Next 30 Days</div>
            <div className="text-3xl font-bold mb-1">{upcomingWeddings.length}</div>
            <div className="text-stone-500 text-sm">Upcoming Weddings</div>
          </div>

          <div className="bg-white border border-stone-200 rounded-xl p-6">
            <div className="text-stone-600 text-sm mb-1">This Year</div>
            <div className="text-3xl font-bold mb-1">{yearWeddings.length}</div>
            <div className="text-stone-500 text-sm">Total Bookings</div>
          </div>

          <div className="bg-white border border-stone-200 rounded-xl p-6">
            <div className="text-stone-600 text-sm mb-1">This Month</div>
            <div className="text-3xl font-bold mb-1">{monthWeddings.length}</div>
            <div className="text-stone-500 text-sm">Weddings Scheduled</div>
          </div>
        </div>

        {/* Date range filter */}
        <DateRangeFilter
          preset={datePreset}
          range={dateRange}
          onChange={({ preset, range }) => { setDatePreset(preset); setDateRange(range); }}
        />

        {/* Calendar Connection Health */}
        <CalendarConnectionHealth venueId={venueId} />

        {/* Chat Session Analytics */}
        <ChatSessionAnalytics venueId={venueId} dateRange={dateRange} />

        {/* Venue Analytics */}
        <VenueAnalytics weddings={weddings} submissions={submissions} packages={packages} />

        {/* Industry Benchmarks */}
        <IndustryBenchmarks />

        {/* Lead Sources */}
        {submissions.length > 0 && (
          <SourceBreakdown submissions={submissions} />
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-semibold text-stone-900 mb-4">Quick Actions</h2>
          <div className="grid md:grid-cols-2 gap-6">
          <Link to={createPageUrl('AdminCalendar') + (venueId ? `?venue_id=${venueId}` : '')} className="bg-white border-2 border-stone-200 rounded-xl p-6 hover:border-stone-400 transition-colors">
            <Calendar className="w-8 h-8 mb-3 text-stone-700" />
            <h3 className="text-lg font-semibold mb-1">Wedding Calendar</h3>
            <p className="text-stone-600 text-sm">View and manage wedding bookings</p>
          </Link>

          <Link to={createPageUrl('AdminWeddings') + (venueId ? `?venue_id=${venueId}` : '')} className="bg-white border-2 border-stone-200 rounded-xl p-6 hover:border-stone-400 transition-colors">
            <BookOpen className="w-8 h-8 mb-3 text-stone-700" />
            <h3 className="text-lg font-semibold mb-1">Weddings List</h3>
            <p className="text-stone-600 text-sm">View all booked weddings</p>
          </Link>

          <Link to={createPageUrl('VenueSettings') + (venueId ? `?venue_id=${venueId}` : '')} className="bg-white border-2 border-stone-200 rounded-xl p-6 hover:border-stone-400 transition-colors">
            <Settings className="w-8 h-8 mb-3 text-stone-700" />
            <h3 className="text-lg font-semibold mb-1">Venue Settings</h3>
            <p className="text-stone-600 text-sm">Manage packages and chatbot training</p>
          </Link>

          <Link to={createPageUrl('Home')} className="bg-white border-2 border-stone-200 rounded-xl p-6 hover:border-stone-400 transition-colors">
            <Home className="w-8 h-8 mb-3 text-stone-700" />
            <h3 className="text-lg font-semibold mb-1">Chatbot Preview</h3>
            <p className="text-stone-600 text-sm">Test your venue's chatbot</p>
          </Link>

          {(user.role === 'admin' || user.role === 'venue_owner') && (
            <Link to={createPageUrl('Feedback')} className="bg-white border-2 border-stone-200 rounded-xl p-6 hover:border-stone-400 transition-colors">
              <MessageSquare className="w-8 h-8 mb-3 text-stone-700" />
              <h3 className="text-lg font-semibold mb-1">Feedback</h3>
              <p className="text-stone-600 text-sm">Review chatbot ratings and flagged replies</p>
            </Link>
          )}
          </div>
        </div>

        {/* Upcoming Weddings */}
        {upcomingWeddings.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-stone-900 mb-4">Upcoming Weddings</h2>
            <div className="bg-white border border-stone-200 rounded-xl p-6">
              <div className="space-y-3">
                {upcomingWeddings.slice(0, 5).map(wedding => (
                  <div key={wedding.id} className="flex items-center justify-between py-2 border-b border-stone-100 last:border-0">
                    <div>
                      <p className="font-medium">{wedding.couple_name || 'Wedding Booking'}</p>
                      <p className="text-sm text-stone-600">{format(new Date(wedding.date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}</p>
                    </div>
                    <div className="text-sm text-stone-500">
                      {wedding.guest_count ? `${wedding.guest_count} guests` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        </div>

      {/* Footer */}
      <footer className="border-t border-stone-200 mt-12 py-4">
        <div className="text-center text-sm text-stone-500">
          Version {APP_VERSION}
        </div>
      </footer>
    </div>
  );
}