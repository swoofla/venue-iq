import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { MessageSquare, ArrowRight, CalendarCheck } from 'lucide-react';
import { createPageUrl } from '../../utils';
import { format, eachDayOfInterval } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// Extract the first user message from a session — that's the "question asked"
function firstUserMessage(messages) {
  if (!Array.isArray(messages)) return '';
  const m = messages.find(x => x.role === 'user' && typeof x.content === 'string');
  return (m?.content || '').trim();
}

// Normalize a question for grouping — lowercased, punctuation stripped, collapsed whitespace
function normalizeQuestion(q) {
  return q.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

export default function ChatSessionAnalytics({ venueId, dateRange }) {
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['chatSessions', venueId],
    queryFn: () => venueId
      ? base44.entities.ChatSession.filter({ venue_id: venueId }, '-created_date', 500)
      : [],
    enabled: !!venueId,
  });

  // Filter sessions by date range
  const filteredSessions = useMemo(() => {
    if (!dateRange?.start || !dateRange?.end) return sessions;
    const start = new Date(dateRange.start).getTime();
    const end = new Date(dateRange.end).getTime() + 24 * 60 * 60 * 1000; // include full end day
    return sessions.filter(s => {
      const t = new Date(s.created_date).getTime();
      return t >= start && t < end;
    });
  }, [sessions, dateRange]);

  // Daily count chart data
  const dailyData = useMemo(() => {
    if (!dateRange?.start || !dateRange?.end) return [];
    const days = eachDayOfInterval({ start: new Date(dateRange.start), end: new Date(dateRange.end) });
    const counts = {};
    filteredSessions.forEach(s => {
      const key = format(new Date(s.created_date), 'yyyy-MM-dd');
      counts[key] = (counts[key] || 0) + 1;
    });
    return days.map(d => ({
      date: format(d, 'MMM d'),
      key: format(d, 'yyyy-MM-dd'),
      sessions: counts[format(d, 'yyyy-MM-dd')] || 0,
    }));
  }, [filteredSessions, dateRange]);

  // Top questions — group by normalized first-user-message
  const topQuestions = useMemo(() => {
    const groups = new Map();
    filteredSessions.forEach(s => {
      const q = firstUserMessage(s.messages);
      if (!q) return;
      const key = normalizeQuestion(q);
      if (!key) return;
      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        groups.set(key, { display: q, count: 1 });
      }
    });
    return Array.from(groups.values()).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [filteredSessions]);

  const sessionsLink = createPageUrl('AdminChatSessions');

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-stone-900">Virtual Planner Usage</h2>

      <div className="grid md:grid-cols-4 gap-4">
        {/* Session count with view link */}
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-stone-600 mb-1">Chat Sessions</p>
              <p className="text-2xl font-bold text-stone-900">
                {isLoading ? '…' : filteredSessions.length}
              </p>
            </div>
            <div className="bg-indigo-50 p-2 rounded-lg">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
          <Link
            to={sessionsLink}
            className="mt-3 inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            View sessions <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Booked Tours — sessions where the tour scheduler completed */}
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-stone-600 mb-1">Booked Tours</p>
              <p className="text-2xl font-bold text-stone-900">
                {filteredSessions.filter(s => s.flow_results?.tour_scheduler).length}
              </p>
            </div>
            <div className="bg-emerald-50 p-2 rounded-lg">
              <CalendarCheck className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <p className="text-xs text-stone-500 mt-3">Booked through the virtual planner</p>
        </div>

        {/* Handoffs */}
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <p className="text-sm text-stone-600 mb-1">Planner Handoffs</p>
          <p className="text-2xl font-bold text-stone-900">
            {filteredSessions.filter(s => s.handoff_triggered).length}
          </p>
          <p className="text-xs text-stone-500 mt-1">Requested human help</p>
        </div>

        {/* Avg messages per session */}
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <p className="text-sm text-stone-600 mb-1">Avg Messages / Session</p>
          <p className="text-2xl font-bold text-stone-900">
            {filteredSessions.length === 0
              ? 'N/A'
              : Math.round(
                  filteredSessions.reduce((sum, s) => sum + (Array.isArray(s.messages) ? s.messages.length : 0), 0) /
                    filteredSessions.length
                )}
          </p>
          <p className="text-xs text-stone-500 mt-1">Engagement depth</p>
        </div>
      </div>

      {/* Daily sessions chart */}
      <div className="bg-white border border-stone-200 rounded-xl p-4">
        <h3 className="text-sm font-medium text-stone-800 mb-3">Sessions per day</h3>
        {dailyData.length === 0 ? (
          <p className="text-sm text-stone-500 py-8 text-center">Select a date range to see daily usage.</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#78716c" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#78716c" />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e7e5e4' }}
                  labelStyle={{ color: '#57534e' }}
                />
                <Line
                  type="monotone"
                  dataKey="sessions"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Top questions */}
      <div className="bg-white border border-stone-200 rounded-xl p-4">
        <h3 className="text-sm font-medium text-stone-800 mb-3">Most common opening questions</h3>
        {topQuestions.length === 0 ? (
          <p className="text-sm text-stone-500 py-4 text-center">No questions in this range yet.</p>
        ) : (
          <div className="space-y-2">
            {topQuestions.map((q, idx) => (
              <div key={idx} className="flex items-start justify-between gap-3 py-2 border-b border-stone-100 last:border-0">
                <p className="text-sm text-stone-800 flex-1 line-clamp-2">"{q.display}"</p>
                <span className="text-sm font-medium text-stone-600 flex-shrink-0 bg-stone-100 rounded-full px-2 py-0.5">
                  {q.count}×
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}