import React, { useState } from 'react';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function HandoffContactCard({
  plannerName,
  topicSummary,
  originalQuestion,
  venueId,
  chatSessionId,
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [touched, setTouched] = useState({ name: false, phone: false, email: false });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const planner = plannerName || 'our planner';

  // Sanitize phone BEFORE validating: keep only digits and a leading +.
  // Kills the invisible-character (bidi mark) class of failure at the UI layer.
  const sanitizedPhone = phone.replace(/[^\d+]/g, '');
  const phoneDigits = sanitizedPhone.replace(/\D/g, '');

  const nameValid = name.trim().length >= 2;
  const phoneValid = phoneDigits.length >= 10;
  // Email is OPTIONAL: valid when blank, otherwise must look like an email.
  const emailTrimmed = email.trim();
  const emailValid = emailTrimmed === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed);

  const showError = (field, valid) => (touched[field] || submitAttempted) && !valid;

  const handleSubmit = async () => {
    setSubmitAttempted(true);
    setSubmitError('');

    // Reveal per-field errors instead of silently disabling the button.
    if (!nameValid || !phoneValid || !emailValid) return;

    // Backend requires chatSessionId and 400s without it. Guard rather than fire a doomed call.
    if (!chatSessionId) {
      setSubmitError('Something went wrong on our end. Please try again in a moment.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('createHighLevelLeadAndNotify', {
        venueId,
        chatSessionId,
        leadName: name.trim(),
        leadPhone: sanitizedPhone,
        leadEmail: emailTrimmed || undefined,
        topicSummary: topicSummary || 'general inquiry',
        originalQuestion: originalQuestion || topicSummary || 'general inquiry',
      });

      const data = res?.data ?? res;
      // Success = a HandoffRequest was created (handoffId present). An intro_failed
      // status still means the lead is captured and the planner has the tagged contact + note,
      // so we treat a returned handoffId as success regardless of SMS outcome.
      if (data && data.handoffId) {
        setDone(true);
      } else {
        setSubmitError("We couldn't send that just now. Please try again.");
      }
    } catch (err) {
      console.error('createHighLevelLeadAndNotify invocation failed:', err?.message || err);
      setSubmitError("We couldn't send that just now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-500">
            <Check className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-green-900">You're all set!</p>
            <p className="mt-1 text-sm text-green-800">
              {planner} will text you shortly. Feel free to keep chatting in the meantime.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const inputBase =
    'w-full rounded-xl border px-3.5 py-2.5 text-base outline-none transition focus:ring-2 focus:ring-offset-0';
  const inputOk = 'border-gray-300 focus:border-gray-400 focus:ring-gray-200';
  const inputErr = 'border-red-400 focus:border-red-400 focus:ring-red-200';

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            placeholder="Your name"
            autoComplete="name"
            className={`${inputBase} ${showError('name', nameValid) ? inputErr : inputOk}`}
          />
          {showError('name', nameValid) && (
            <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5" /> Please enter your name.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
            placeholder="(555) 123-4567"
            autoComplete="tel"
            className={`${inputBase} ${showError('phone', phoneValid) ? inputErr : inputOk}`}
          />
          {showError('phone', phoneValid) && (
            <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5" /> Please enter a valid phone number.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Email <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            placeholder="you@email.com"
            autoComplete="email"
            className={`${inputBase} ${showError('email', emailValid) ? inputErr : inputOk}`}
          />
          {showError('email', emailValid) && (
            <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5" /> Please enter a valid email or leave it blank.
            </p>
          )}
        </div>

        {submitError && (
          <p className="flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 flex-shrink-0" /> {submitError}
          </p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-base font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Sending…
            </>
          ) : (
            'Text me'
          )}
        </button>
      </div>
    </div>
  );
}