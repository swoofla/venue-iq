import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Calendar, Home, Settings, BookOpen, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { format, addDays, startOfMonth, endOfMonth } from 'date-fns';
import VenueAnalytics from '@/components/dashboard/VenueAnalytics';
import IndustryBenchmarks from '@/components/dashboard/IndustryBenchmarks';
import SourceBreakdown from '@/components/dashboard/SourceBreakdown';

export default function Dashboard() {
  const [user, setUser] = useState(null);

  React.useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: venue } = useQuery({
    queryKey: ['venue', user?.venue_id],
    queryFn: () => user?.venue_id ? base44.entities.Venue.get(user.venue_id) : null,
    enabled: !!user?.venue_id
  });

  const { data: weddings = [] } = useQuery({
    queryKey: ['weddings', user?.venue_id],
    queryFn: () => user?.venue_id ? base44.entities.BookedWeddingDate.filter({ venue_id: user.venue_id }) : [],
    enabled: !!user?.venue_id
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ['submissions', user?.venue_id],
    queryFn: () => user?.venue_id ? base44.entities.ContactSubmission.filter({ venue_id: user.venue_id }) : [],
    enabled: !!user?.venue_id
  });

  const { data: packages = [] } = useQuery({
    queryKey: ['packages', user?.venue_id],
    queryFn: () => user?.venue_id ? base44.entities.VenuePackage.filter({ venue_id: user.venue_id }) : [],
    enabled: !!user?.venue_id
  });

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-center">Loading...</div></div>;
  }

  // Super admins (no venue_id) go to SuperAdmin page
  if (user.role === 'admin' && !user.venue_id) {
    window.location.href = createPageUrl('SuperAdmin');
    return <div className="min-h-screen flex items-center justify-center"><div className="text-center">Redirecting...</div></div>;
  }

  // Regular users without venue assignment
  if (!user.venue_id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">No Venue Assigned</h2>
          <p className="text-stone-600 mb-4">Your account hasn't been assigned to a venue yet. Please contact your administrator.</p>
          <Button onClick={() => base44.auth.logout()}>Logout</Button>
        </div>
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

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="border-b border-stone-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Dashboard</h1>
              {venue && <p className="text-sm text-stone-600">{venue.name}</p>}
            </div>
            <Button onClick={() => base44.auth.logout()} variant="outline">
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
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
          <Link to={createPageUrl('AdminCalendar')} className="bg-white border-2 border-stone-200 rounded-xl p-6 hover:border-stone-400 transition-colors">
            <Calendar className="w-8 h-8 mb-3 text-stone-700" />
            <h3 className="text-lg font-semibold mb-1">Wedding Calendar</h3>
            <p className="text-stone-600 text-sm">View and manage wedding bookings</p>
          </Link>

          <Link to={createPageUrl('AdminWeddings')} className="bg-white border-2 border-stone-200 rounded-xl p-6 hover:border-stone-400 transition-colors">
            <BookOpen className="w-8 h-8 mb-3 text-stone-700" />
            <h3 className="text-lg font-semibold mb-1">Weddings List</h3>
            <p className="text-stone-600 text-sm">View all booked weddings</p>
          </Link>

          <Link to={createPageUrl('VenueSettings')} className="bg-white border-2 border-stone-200 rounded-xl p-6 hover:border-stone-400 transition-colors">
            <Settings className="w-8 h-8 mb-3 text-stone-700" />
            <h3 className="text-lg font-semibold mb-1">Venue Settings</h3>
            <p className="text-stone-600 text-sm">Manage packages and chatbot training</p>
          </Link>

          <Link to={createPageUrl('Home')} className="bg-white border-2 border-stone-200 rounded-xl p-6 hover:border-stone-400 transition-colors">
            <Home className="w-8 h-8 mb-3 text-stone-700" />
            <h3 className="text-lg font-semibold mb-1">Chatbot Preview</h3>
            <p className="text-stone-600 text-sm">Test your venue's chatbot</p>
          </Link>
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
    </div>
  );
}