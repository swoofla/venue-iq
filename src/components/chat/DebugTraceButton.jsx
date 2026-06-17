import React, { useState } from 'react';

/**
 * Floating "Copy debug log" button.
 *
 * Observability ONLY — does not affect chatbot behavior in any way.
 * Only rendered when the URL has ?debug=1 (gated by the parent).
 *
 * Copies JSON.stringify(traceRef.current, null, 2) to the clipboard.
 * Falls back to a window.prompt() if the Clipboard API is unavailable
 * (e.g. unsupported browser or insecure context).
 */
export default function DebugTraceButton({ traceRef }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const payload = JSON.stringify(traceRef.current || [], null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback when Clipboard API unavailable — show the JSON for manual copy.
      // eslint-disable-next-line no-alert
      window.prompt('Copy debug log:', payload);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="fixed bottom-4 right-4 z-50 bg-amber-500 text-black rounded-full shadow-lg hover:bg-amber-400 transition-colors"
      style={{ padding: '8px 14px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em' }}
    >
      {copied ? 'COPIED' : 'COPY DEBUG LOG'}
    </button>
  );
}