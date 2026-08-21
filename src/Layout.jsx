import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LayoutDashboard, MessageSquare, Calendar, Settings, Building2, LogOut } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useVenue } from '@/lib/VenueContext';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

// Pages that get the venue-owner shell. This is an ALLOW-LIST on purpose.
// Home is the bride-facing chatbot and is embedded in an iframe on the venue's
// own website; QuoteSummary and FirstLookEmbed are opened from external links.
// None of those may ever render venue-owner navigation.
const SHELL_PAGES = [
  'Dashboard',
  'AdminChatSessions',
  'ChatTranscript',
  'AdminCalendar',
  'AdminWeddings',
  'VenueSettings',
  'Feedback',
  'SuperAdmin'
];

const NAV = [
  { page: 'Dashboard',         label: 'Dashboard',    icon: LayoutDashboard },
  { page: 'AdminChatSessions', label: 'Conversations', icon: MessageSquare, alsoActiveOn: ['ChatTranscript', 'Feedback'] },
  { page: 'AdminCalendar',     label: 'Calendar',     icon: Calendar, alsoActiveOn: ['AdminWeddings'] },
  { page: 'VenueSettings',     label: 'Settings',     icon: Settings }
];

export default function Layout({ children }) {
  const location = useLocation();
  // pathname never contains a query string, so the old .split('?') was a no-op.
  const currentPage = location.pathname.replace(/^\//, '');
  const { user, isAdmin, venueId, setVenueId, venues, selectedVenue } = useVenue();

  if (!SHELL_PAGES.includes(currentPage)) {
    return <>{children}</>;
  }

  const isActive = (item) =>
    currentPage === item.page || (item.alsoActiveOn || []).includes(currentPage);

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14 gap-4">
            <Link to={createPageUrl('Dashboard')} className="font-semibold text-stone-900 tracking-tight whitespace-nowrap">
              Virtual Planner
            </Link>

            <div className="flex items-center gap-3 min-w-0">
              {/* Which venue am I looking at. An admin manages several and the
                  choice now persists across navigation, so without this there
                  is nothing on screen saying which one. */}
              {isAdmin && !user?.venue_id && venues.length > 0 && (
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="w-4 h-4 text-stone-400 shrink-0" />
                  <Select value={venueId || ''} onValueChange={setVenueId}>
                    <SelectTrigger className="h-8 w-[180px] text-sm border-stone-200">
                      <SelectValue placeholder="Choose a venue" />
                    </SelectTrigger>
                    <SelectContent>
                      {venues.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {!isAdmin && selectedVenue && (
                <span className="text-sm text-stone-600 truncate">{selectedVenue.name}</span>
              )}

              {user && (
                <button
                  onClick={() => base44.auth.logout()}
                  className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900 transition-colors shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Log out</span>
                </button>
              )}
            </div>
          </div>
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {NAV.map(item => {
              const Icon = item.icon;
              const active = isActive(item);
              return (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  className={`flex items-center gap-2 px-3 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
                    active
                      ? 'border-stone-900 text-stone-900 font-medium'
                      : 'border-transparent text-stone-500 hover:text-stone-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}