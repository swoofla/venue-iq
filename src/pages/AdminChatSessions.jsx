import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { MessageSquare, ArrowLeft, Search, UserRoundCheck, CalendarCheck } from 'lucide-react';
import { createPageUrl } from '../utils';

function formatWhen(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  } catch { return ''; }
}

function firstUserMessage(messages) {
  if (!Array.isArray(messages)) return '';
  const m = messages.find(x => x.role === 'user' && typeof x.content === 'string');
  return m?.content || '';
}

export default function AdminChatSessions() {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all'); // 'all' | 'handoff' | 'tour' | 'conversation'

  useEffect(() => {
    base44.entities.ChatSession.list('-created_date', 200)
      .then(setSessions)
      .finally(() => setLoading(false));
  }, []);

  const handoffCount = useMemo(
    () => sessions.filter(s => s.handoff_triggered).length,
    [sessions]
  );

  const tourCount = useMemo(
    () => sessions.filter(s => s.flow_results?.tour_scheduler).length,
    [sessions]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = sessions;
    if (category === 'handoff') list = list.filter(s => s.handoff_triggered);
    else if (category === 'tour') list = list.filter(s => s.flow_results?.tour_scheduler);
    else if (category === 'conversation') list = list.filter(s => !s.handoff_triggered && !s.flow_results?.tour_scheduler);
    if (!q) return list;
    return list.filter(s => {
      const hay = [
        s.lead_name, s.lead_email, s.lead_phone,
        s.handoff_topic, s.lead_wedding_date,
        firstUserMessage(s.messages),
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [sessions, query, category]);

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-black text-white px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl('Dashboard')} className="text-white/60 hover:text-white">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 style={{ fontSize: '15px', fontWeight: 500 }}>Chat sessions</h1>
          </div>
          <span style={{ fontSize: '10px', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.55)' }}>
            {sessions.length} TOTAL
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-6">
        <div className="relative mb-5">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, phone, topic, or first message…"
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-stone-200 rounded-lg text-sm outline-none focus:border-stone-400"
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {[
            { id: 'all', label: 'All', count: sessions.length },
            { id: 'handoff', label: 'Handoffs', count: handoffCount },
            { id: 'tour', label: 'Booked tours', count: tourCount },
            { id: 'conversation', label: 'Conversations', count: sessions.filter(s => !s.handoff_triggered && !s.flow_results?.tour_scheduler).length },
          ].map((tab) => {
            const active = category === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCategory(tab.id)}
                className={`px-3 py-1.5 rounded-full border transition-colors ${
                  active
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400'
                }`}
                style={{ fontSize: '12px', fontWeight: 500 }}
              >
                {tab.label} <span className={active ? 'text-white/60' : 'text-stone-400'}>({tab.count})</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <p className="text-sm text-stone-500 text-center py-12">Loading sessions…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-stone-500 text-center py-12">
            {sessions.length === 0 ? 'No chat sessions yet.' : 'No sessions match your search.'}
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((s) => {
              const preview = firstUserMessage(s.messages);
              const msgCount = Array.isArray(s.messages) ? s.messages.length : 0;
              return (
                <Link
                  key={s.id}
                  to={`${createPageUrl('ChatTranscript')}?id=${s.id}`}
                  className="block bg-white border border-stone-200 rounded-xl p-4 hover:border-stone-400 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="min-w-0">
                      <p className="text-stone-900 font-medium truncate" style={{ fontSize: '14px' }}>
                        {s.lead_name || 'Anonymous lead'}
                      </p>
                      <p className="text-stone-500 truncate" style={{ fontSize: '12px' }}>
                        {[s.lead_email, s.lead_phone].filter(Boolean).join(' · ') || 'no contact info'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-stone-500" style={{ fontSize: '11px' }}>
                        {formatWhen(s.created_date)}
                      </p>
                      <p className="text-stone-400 flex items-center justify-end gap-1 mt-0.5" style={{ fontSize: '11px' }}>
                        <MessageSquare className="w-3 h-3" />
                        {msgCount}
                      </p>
                    </div>
                  </div>
                  {preview && (
                    <p className="text-stone-600 line-clamp-2" style={{ fontSize: '13px' }}>
                      "{preview}"
                    </p>
                  )}
                  {(s.handoff_triggered || s.flow_results?.tour_scheduler || s.handoff_topic || s.lead_wedding_date || s.lead_guest_count) && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {s.flow_results?.tour_scheduler && (
                        <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-100 rounded-full px-2 py-0.5" style={{ fontSize: '11px', fontWeight: 500 }}>
                          <CalendarCheck className="w-3 h-3" />
                          Tour booked
                        </span>
                      )}
                      {s.handoff_triggered && (
                        <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-100 rounded-full px-2 py-0.5" style={{ fontSize: '11px', fontWeight: 500 }}>
                          <UserRoundCheck className="w-3 h-3" />
                          Handoff
                        </span>
                      )}
                      {s.handoff_topic && (
                        <span className="text-stone-600 bg-stone-100 rounded-full px-2 py-0.5" style={{ fontSize: '11px' }}>
                          {s.handoff_topic}
                        </span>
                      )}
                      {s.lead_wedding_date && (
                        <span className="text-stone-600 bg-stone-100 rounded-full px-2 py-0.5" style={{ fontSize: '11px' }}>
                          📅 {s.lead_wedding_date}
                        </span>
                      )}
                      {s.lead_guest_count && (
                        <span className="text-stone-600 bg-stone-100 rounded-full px-2 py-0.5" style={{ fontSize: '11px' }}>
                          👥 {s.lead_guest_count} guests
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}