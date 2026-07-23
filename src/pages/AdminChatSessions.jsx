import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { MessageSquare, ArrowLeft, Search, UserRoundCheck, CalendarCheck, Download } from 'lucide-react';
import { createPageUrl } from '../utils';

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function transcriptToText(messages) {
  if (!Array.isArray(messages)) return '';
  return messages
    .filter(m => m && typeof m.content === 'string')
    .map(m => `[${m.role === 'bot' ? 'Bot' : 'User'}] ${m.content}`)
    .join('\n');
}

function downloadSessionsCsv(sessions) {
  const headers = [
    'session_id', 'created_date', 'lead_name', 'lead_email', 'lead_phone',
    'lead_wedding_date', 'lead_guest_count', 'lead_budget_range',
    'handoff_triggered', 'handoff_topic', 'tour_booked', 'status',
    'message_count', 'transcript',
  ];
  const rows = sessions.map(s => [
    s.id,
    s.created_date || '',
    s.lead_name || '',
    s.lead_email || '',
    s.lead_phone || '',
    s.lead_wedding_date || '',
    s.lead_guest_count ?? '',
    s.lead_budget_range || '',
    s.handoff_triggered ? 'yes' : 'no',
    s.handoff_topic || '',
    s.flow_results?.tour_scheduler ? 'yes' : 'no',
    s.status || '',
    Array.isArray(s.messages) ? s.messages.length : 0,
    transcriptToText(s.messages),
  ].map(csvEscape).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat-sessions-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatWhen(iso) {
  try {
    // DB timestamps come back as ISO strings without a trailing 'Z' but ARE UTC.
    // Without the Z, `new Date()` parses them as local time, which shifts the
    // display by the viewer's UTC offset. Force UTC parsing by appending Z.
    const normalized = typeof iso === 'string' && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso)
      ? iso + 'Z'
      : iso;
    const d = new Date(normalized);
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
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  useEffect(() => {
    base44.entities.ChatSession.list('-created_date', 1000)
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

  const toggleOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every(s => selectedIds.has(s.id));
  const toggleAllFiltered = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach(s => next.delete(s.id));
      } else {
        filtered.forEach(s => next.add(s.id));
      }
      return next;
    });
  };

  const exportSelected = () => {
    const chosen = sessions.filter(s => selectedIds.has(s.id));
    if (chosen.length === 0) return;
    downloadSessionsCsv(chosen);
  };

  const exportAll = () => {
    if (sessions.length === 0) return;
    downloadSessionsCsv(sessions);
  };

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
        <div className="relative mb-4">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, phone, topic, or first message…"
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-stone-200 rounded-lg text-sm outline-none focus:border-stone-400"
          />
        </div>

        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <label className="flex items-center gap-2 text-stone-700 cursor-pointer select-none" style={{ fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleAllFiltered}
              className="w-4 h-4 accent-black"
            />
            Select all shown
            {selectedIds.size > 0 && (
              <span className="text-stone-500 ml-1">({selectedIds.size} selected)</span>
            )}
          </label>
          <div className="flex gap-2">
            <button
              onClick={exportSelected}
              disabled={selectedIds.size === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-stone-200 bg-white text-stone-700 hover:border-stone-400 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ fontSize: '12px', fontWeight: 500 }}
            >
              <Download className="w-3.5 h-3.5" />
              Export selected
            </button>
            <button
              onClick={exportAll}
              disabled={sessions.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black text-white border border-black hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ fontSize: '12px', fontWeight: 500 }}
            >
              <Download className="w-3.5 h-3.5" />
              Export all
            </button>
          </div>
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
              const checked = selectedIds.has(s.id);
              return (
                <div
                  key={s.id}
                  className={`flex items-start gap-3 bg-white border rounded-xl p-4 transition-colors ${checked ? 'border-stone-900' : 'border-stone-200 hover:border-stone-400'}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => { e.stopPropagation(); toggleOne(s.id); }}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 w-4 h-4 accent-black flex-shrink-0 cursor-pointer"
                    aria-label={`Select session from ${s.lead_name || 'anonymous lead'}`}
                  />
                  <Link
                    to={`${createPageUrl('ChatTranscript')}?id=${s.id}`}
                    className="flex-1 min-w-0 block"
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
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}