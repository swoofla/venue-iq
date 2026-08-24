import React, { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Sparkles, CheckCircle2, Copy, Check, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { createPageUrl } from '../utils';

function formatDuration(start, end) {
  try {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (!ms || ms < 0) return '—';
    const mins = Math.max(1, Math.round(ms / 60000));
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem ? `${hrs}h ${rem}m` : `${hrs}h`;
  } catch {
    return '—';
  }
}

function FlowRow({ name, result }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
      <div className="text-sm text-stone-800">
        <span className="font-medium">{name}</span>
        {result && <span className="text-stone-600"> → {result}</span>}
      </div>
    </div>
  );
}

const FLOW_LABELS = {
  budget_calculator: 'Budget calculator',
  date_check: 'Date check',
  tour_scheduler: 'Tour scheduler',
  packages: 'Packages',
  gallery: 'Gallery',
  visualizer: 'Visualizer'
};

function flowResultText(flowName, result) {
  if (!result) return null;
  if (flowName === 'budget_calculator' && result.total) {
    return `$${Number(result.total).toLocaleString()}`;
  }
  if (flowName === 'date_check') {
    if (result.date) return `${result.date}${result.available ? ' · Available' : ''}`;
  }
  if (flowName === 'tour_scheduler') {
    if (result.tour_date) return `${result.tour_date}${result.tour_time ? ' at ' + result.tour_time : ''}`;
  }
  return typeof result === 'string' ? result : null;
}

export default function ChatTranscript() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const id = searchParams.get('id');
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [siblingIds, setSiblingIds] = useState([]); // ordered newest-first, for prev/next nav

  useEffect(() => {
    if (!id) {
      setError(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    base44.functions.invoke('getChatSessionPublic', { id })
      .then((res) => {
        if (res?.data?.session) {
          setSession(res.data.session);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  // Load sibling session IDs once the current session is known, scoped to the same venue.
  useEffect(() => {
    if (!session?.id) return;
    // We don't have direct venue_id back from getChatSessionPublic — but admin RLS
    // now allows reading ChatSession, so pull the newest 200 ordered by created_date.
    base44.entities.ChatSession.list('-created_date', 200)
      .then(list => setSiblingIds(list.map(s => s.id)))
      .catch(() => setSiblingIds([]));
  }, [session?.id]);

  const currentIdx = siblingIds.indexOf(id);
  const prevId = currentIdx > 0 ? siblingIds[currentIdx - 1] : null; // newer
  const nextId = currentIdx >= 0 && currentIdx < siblingIds.length - 1 ? siblingIds[currentIdx + 1] : null; // older
  const goTo = (targetId) => {
    if (!targetId) return;
    navigate(`${createPageUrl('ChatTranscript')}?id=${targetId}`);
  };

  if (loading) {
    return <div className="text-stone-500 text-sm py-12 text-center">Loading transcript…</div>;
  }

  if (error || !session) {
    return <p className="text-stone-500 text-center text-sm py-12">This transcript is no longer available.</p>;
  }

  const venueName = session.venue_name || 'Venue';
  const messages = session.messages || [];
  const flows = session.flows_completed || [];
  const flowResults = session.flow_results || {};
  const duration = formatDuration(session.created_date, session.updated_date);

  const buildTranscriptText = () => {
    const header = [
      `${venueName} — Chat transcript`,
      `Lead: ${session.lead_name || 'Anonymous'}`,
      [session.lead_phone, session.lead_email].filter(Boolean).join(' · ') || null,
      `Wedding date: ${session.lead_wedding_date || 'not shared'}`,
      `Guest count: ${session.lead_guest_count || 'not shared'}`,
      `Budget feel: ${session.lead_budget_range || 'not shared'}`,
      `Duration: ${duration}`,
    ].filter(Boolean).join('\n');
    const body = messages
      .map(m => `${m.role === 'bot' ? 'Bot' : 'Bride'}: ${m.content || ''}`)
      .join('\n\n');
    return `${header}\n\n---\n\n${body}`;
  };

  const handleCopy = async () => {
    const text = buildTranscriptText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy transcript:', text);
    }
  };

  return (
    <div>
      <main className="max-w-2xl mx-auto px-5 py-6">
        {/* Session navigation — back link and prev/next pager, previously in the black top bar. */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to={createPageUrl('AdminChatSessions')}
              className="text-stone-500 hover:text-stone-900 flex items-center gap-1"
              style={{ fontSize: '12px' }}
            >
              <ArrowLeft className="w-4 h-4" />
              All sessions
            </Link>
            <span className="text-stone-300">·</span>
            <h1 className="truncate text-stone-900" style={{ fontSize: '15px', fontWeight: 500 }}>{venueName}</h1>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => goTo(prevId)}
              disabled={!prevId}
              className="p-1.5 rounded text-stone-600 hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Newer session"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => goTo(nextId)}
              disabled={!nextId}
              className="p-1.5 rounded text-stone-600 hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Older session"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Lead info */}
        <div className="mb-6">
          <p style={{ fontSize: '19px', fontWeight: 500 }} className="text-stone-900">
            {session.lead_name || 'Anonymous lead'}
          </p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="text-stone-600" style={{ fontSize: '12px' }}>
              {[session.lead_phone, session.lead_email, duration].filter(Boolean).join(' · ')}
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 rounded-full hover:border-stone-400 transition-colors text-stone-700"
              style={{ fontSize: '12px' }}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy transcript'}
            </button>
          </div>
        </div>

        {/* What she shared */}
        <div
          className="bg-white border-stone-200 mb-4 p-4"
          style={{ borderWidth: '0.5px', borderRadius: '12px', borderStyle: 'solid' }}
        >
          <h3
            className="text-stone-600 mb-3"
            style={{ fontSize: '10px', letterSpacing: '0.15em' }}
          >
            WHAT SHE SHARED
          </h3>
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-stone-500">Wedding date</span>
              <span className="text-stone-900">{session.lead_wedding_date || 'not shared'}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-stone-500">Guest count</span>
              <span className="text-stone-900">{session.lead_guest_count || 'not shared'}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-stone-500">Budget feel</span>
              <span className="text-stone-900">{session.lead_budget_range || 'not shared'}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-stone-500">Asked about</span>
              <span className="text-stone-900">{session.handoff_topic || 'not shared'}</span>
            </div>
          </div>
        </div>

        {/* Flows used */}
        <div
          className="bg-white border-stone-200 mb-6 p-4"
          style={{ borderWidth: '0.5px', borderRadius: '12px', borderStyle: 'solid' }}
        >
          <h3
            className="text-stone-600 mb-3"
            style={{ fontSize: '10px', letterSpacing: '0.15em' }}
          >
            FLOWS USED
          </h3>
          {flows.length === 0 ? (
            <p className="text-sm text-stone-500">None — bride asked a question directly.</p>
          ) : (
            <div>
              {flows.map((flow) => (
                <FlowRow
                  key={flow}
                  name={FLOW_LABELS[flow] || flow}
                  result={flowResultText(flow, flowResults[flow])}
                />
              ))}
            </div>
          )}
        </div>

        {/* Transcript */}
        <h3
          className="text-stone-600 mb-3"
          style={{ fontSize: '10px', letterSpacing: '0.15em' }}
        >
          TRANSCRIPT
        </h3>

        <div className="space-y-3">
          {messages.map((m, idx) => {
            const isBot = m.role === 'bot';
            return (
              <div key={idx} className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
                {isBot && (
                  <div
                    className="rounded-full bg-stone-100 flex items-center justify-center mr-2 flex-shrink-0"
                    style={{ width: '26px', height: '26px' }}
                  >
                    <Sparkles style={{ width: '13px', height: '13px' }} className="text-stone-600" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] ${
                    isBot ? 'bg-stone-50 text-stone-900 border border-stone-200' : 'bg-black text-white'
                  }`}
                  style={{
                    padding: '9px 13px',
                    fontSize: '13px',
                    lineHeight: 1.45,
                    borderRadius: isBot ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
                    borderWidth: isBot ? '0.5px' : 0,
                  }}
                >
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{m.content}</p>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}