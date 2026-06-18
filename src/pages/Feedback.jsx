import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ThumbsDown, ThumbsUp, ChevronDown, ChevronRight } from 'lucide-react';

export default function Feedback() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('down'); // 'down' | 'all'
  const [expanded, setExpanded] = useState({});
  const [authStatus, setAuthStatus] = useState('checking'); // 'checking' | 'authorized' | 'forbidden'

  useEffect(() => {
    (async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (!isAuth) { setAuthStatus('forbidden'); return; }
        const me = await base44.auth.me();
        const allowed = me?.role === 'admin' || me?.role === 'venue_owner';
        setAuthStatus(allowed ? 'authorized' : 'forbidden');
      } catch {
        setAuthStatus('forbidden');
      }
    })();
  }, []);

  useEffect(() => {
    if (authStatus !== 'authorized') return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const all = await base44.entities.ChatFeedback.list();
        const arr = Array.isArray(all) ? all : (all?.records ?? all?.data ?? []);
        arr.sort((a, b) =>
          new Date(b.created_date || b.created_at || 0) - new Date(a.created_date || a.created_at || 0)
        );
        const filtered = filter === 'down' ? arr.filter(r => r.rating === 'down') : arr;
        if (!cancelled) setRecords(filtered);
      } catch (err) {
        console.error('Failed to load feedback:', err?.message || err);
        if (!cancelled) setRecords([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [filter, authStatus]);

  if (authStatus === 'checking') {
    return <div className="mx-auto max-w-3xl p-6 text-sm text-gray-500">Loading…</div>;
  }
  if (authStatus === 'forbidden') {
    return <div className="mx-auto max-w-3xl p-6 text-sm text-gray-500">Not found.</div>;
  }

  const fmtDate = (r) => {
    const raw = r.created_date || r.created_at;
    if (!raw) return '';
    try { return new Date(raw).toLocaleString(); } catch { return raw; }
  };
  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Chat Feedback</h1>
        <div className="flex rounded-lg border border-gray-200 p-0.5 text-sm">
          <button onClick={() => setFilter('down')} className={`rounded-md px-3 py-1 ${filter === 'down' ? 'bg-gray-900 text-white' : 'text-gray-600'}`}>Thumbs-down</button>
          <button onClick={() => setFilter('all')} className={`rounded-md px-3 py-1 ${filter === 'all' ? 'bg-gray-900 text-white' : 'text-gray-600'}`}>All</button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : records.length === 0 ? (
        <p className="text-sm text-gray-500">No {filter === 'down' ? 'thumbs-down ' : ''}feedback yet.</p>
      ) : (
        <div className="space-y-3">
          {records.map((r) => (
            <div key={r.id} className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                {r.rating === 'down' ? <ThumbsDown className="h-4 w-4 text-red-500" /> : <ThumbsUp className="h-4 w-4 text-green-600" />}
                <span>{fmtDate(r)}</span>
              </div>
              {r.comment && <p className="mt-2 text-sm font-medium text-gray-900">“{r.comment}”</p>}
              <div className="mt-3 space-y-1 text-sm">
                {r.preceding_user_message && <p className="text-gray-700"><span className="text-gray-400">She said: </span>{r.preceding_user_message}</p>}
                {r.flagged_message && <p className="text-gray-700"><span className="text-gray-400">Bot replied: </span>{r.flagged_message}</p>}
              </div>
              <button onClick={() => toggle(r.id)} className="mt-3 flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800">
                {expanded[r.id] ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                Full conversation & trace
              </button>
              {expanded[r.id] && (
                <div className="mt-2 space-y-3">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase text-gray-400">Transcript</p>
                    <div className="space-y-1 rounded-lg bg-gray-50 p-3 text-sm">
                      {((r.transcript?.messages) || []).map((m, i) => (
                        <p key={i} className={m.role === 'bot' ? 'text-gray-700' : 'text-gray-900'}>
                          <span className="text-gray-400">{m.role === 'bot' ? 'Bot' : 'User'}: </span>{m.content}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase text-gray-400">Debug trace</p>
                    <pre className="max-h-96 overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">{JSON.stringify(r.debug_trace?.turns ?? r.debug_trace, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}