import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LayoutDashboard, MessageSquare, Calendar, Brain, Settings } from 'lucide-react';

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
  const currentPage = location.pathname.replace(/^\//, '').split('?')[0];

  if (!SHELL_PAGES.includes(currentPage)) {
    return <>{children}</>;
  }

  const isActive = (item) =>
    currentPage === item.page || (item.alsoActiveOn || []).includes(currentPage);

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <Link to={createPageUrl('Dashboard')} className="font-semibold text-stone-900 tracking-tight">
              Virtual Planner
            </Link>
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
      <main className="max-w-6xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}