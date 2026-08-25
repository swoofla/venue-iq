import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';

// Loads the REAL bride-facing chatbot in an iframe rather than re-implementing
// it. embed=1 is required: without it the page redirects a logged-in owner
// straight to the dashboard. debug=1 exposes the trace button so the owner can
// see what knowledge the bot retrieved for an answer.
export default function PlannerTestChat({ venue }) {
  const [reloadKey, setReloadKey] = useState(0);

  if (!venue?.slug) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-900">
          This venue doesn't have a public link set up yet, so the chatbot can't be
          previewed here. Ask your administrator to set the venue's URL name.
        </p>
      </div>
    );
  }

  const src = `/?venue=${encodeURIComponent(venue.slug)}&embed=1&debug=1`;

  return (
    <div>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
        <p className="text-sm text-blue-900">
          This is your live chatbot, exactly as brides see it on your website. Ask it
          anything to check its answers. Test conversations are saved with your real
          ones, and any contact details you enter will create a real lead.
        </p>
      </div>

      <div className="flex justify-end mb-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // The chatbot restores its last transcript from localStorage, so
            // remounting alone would bring the old conversation back.
            try { window.localStorage.removeItem(`viq_chat_v1_${venue.slug}`); } catch { /* ignore */ }
            setReloadKey(k => k + 1);
          }}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Start over
        </Button>
      </div>

      <div className="border border-stone-200 rounded-xl overflow-hidden bg-white">
        <iframe
          key={reloadKey}
          src={src}
          title="Chatbot preview"
          className="w-full h-[700px] block border-0"
        />
      </div>
    </div>
  );
}