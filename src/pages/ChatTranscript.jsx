import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Sparkles, CheckCircle2 } from 'lucide-react';

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
  const id = searchParams.get('id');
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) {
      setError(true);
      setLoading(false);
      return;
    }
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-stone-500 text-sm">Loading transcript…</div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 px-6">
        <p className="text-stone-500 text-center text-sm">This transcript is no longer available.</p>
      </div>
    );
  }

  const venueName = session.venue_name || 'Venue';
  const messages = session.messages || [];
  const flows = session.flows_completed || [];
  const flowResults = session.flow_results || {};
  const duration = formatDuration(session.created_date, session.updated_date);

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Top bar */}
      <header className="bg-black text-white px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 style={{ fontSize: '15px', fontWeight: 500 }}>{venueName}</h1>
          <span
            style={{
              fontSize: '10px',
              letterSpacing: '0.15em',
              color: 'rgba(255,255,255,0.55)',
            }}
          >
            TRANSCRIPT
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6">
        {/* Lead info */}
        <div className="mb-6">
          <p style={{ fontSize: '19px', fontWeight: 500 }} className="text-stone-900">
            {session.lead_name || 'Anonymous lead'}
          </p>
          <p className="text-stone-600 mt-1" style={{ fontSize: '12px' }}>
            {[session.lead_phone, session.lead_email, duration].filter(Boolean).join(' · ')}
          </p>
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