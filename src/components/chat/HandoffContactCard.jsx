import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Loader2, Check } from 'lucide-react';

/**
 * Inline contact card rendered as a chat message after the bride accepts
 * a planner handoff. Mobile-friendly: 16px inputs, 44px tap targets.
 * The backend (createHighLevelContact) owns the fallback — if HighLevel fails,
 * it creates a ContactSubmission server-side. The card is non-blocking — the
 * bride can ignore it and keep chatting.
 */
export default function HandoffContactCard({
  plannerName,
  topicSummary,
  venueId,
  chatSessionId,
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const phoneValid = /^[\d\s\-()+]{10,}$/.test(phone.trim());
  const canSubmit = name.trim().length >= 2 && emailValid && phoneValid && !submitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();
    const notes = `Virtual planner handoff — topic: ${topicSummary || 'general inquiry'}. ChatSession: ${chatSessionId || 'n/a'}`;

    try {
      await base44.functions.invoke('createHighLevelContact', {
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        source: 'virtual_planner_handoff',
        notes,
        venue_id: venueId,
      });
    } catch (err) {
      // Backend now owns the ContactSubmission fallback. If even this call
      // fails (network), just log — the bride still sees confirmation.
      console.error('createHighLevelContact invocation failed:', err?.message || err);
    }

    setSubmitting(false);
    setDone(true);
  };

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 flex items-start gap-2"
      >
        <div className="rounded-2xl rounded-bl-md bg-stone-100 px-4 py-3 text-stone-700 text-sm flex items-center gap-2">
          <Check className="w-4 h-4 text-green-600" />
          You're all set — {plannerName} will reach out!
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 bg-white border border-stone-200 rounded-2xl p-4 shadow-sm"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="First name"
          autoComplete="given-name"
          className="w-full rounded-xl border border-stone-200 px-3 outline-none focus:border-stone-400"
          style={{ fontSize: '16px', minHeight: '44px' }}
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          inputMode="email"
          className="w-full rounded-xl border border-stone-200 px-3 outline-none focus:border-stone-400"
          style={{ fontSize: '16px', minHeight: '44px' }}
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
          autoComplete="tel"
          inputMode="tel"
          className="w-full rounded-xl border border-stone-200 px-3 outline-none focus:border-stone-400"
          style={{ fontSize: '16px', minHeight: '44px' }}
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-xl bg-black text-white font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ fontSize: '15px', minHeight: '44px' }}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : `Have ${plannerName} text me`}
        </button>
      </form>
    </motion.div>
  );
}