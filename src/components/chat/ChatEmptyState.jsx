import React from 'react';
import { Sparkles } from 'lucide-react';

// Venue-specific suggestion prompts shown in place of the generic greeting.
// Conrad Mansion asked for these three lead-in prompts.
const CONRAD_PROMPTS = [
  'Ask us about our 2028 pricing',
  'Ask us about our One-Day Package options',
  'Ask us how to add an extra day to your stay',
];

export default function ChatEmptyState({ venueName, venueSlug, onSuggestion }) {
  const isConrad = venueSlug === 'the-conrad-mansion';
  const prompts = isConrad && onSuggestion ? CONRAD_PROMPTS : null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div
        className="rounded-full bg-stone-100 flex items-center justify-center mb-6"
        style={{ width: '64px', height: '64px' }}
      >
        <Sparkles style={{ width: '22px', height: '22px' }} className="text-stone-700" />
      </div>
      <h2
        className="text-stone-900 text-center"
        style={{
          fontSize: '24px',
          fontWeight: 500,
          letterSpacing: '-0.01em',
          marginBottom: '10px',
        }}
      >
        Hi, I'm your virtual planner for {venueName}
      </h2>
      {prompts ? (
        <div className="flex flex-col items-center gap-2 w-full" style={{ maxWidth: '320px' }}>
          {prompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onSuggestion(prompt)}
              className="w-full text-center text-stone-800 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-full transition-colors"
              style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 500 }}
            >
              {prompt}
            </button>
          ))}
        </div>
      ) : (
        <p
          className="text-stone-500 text-center"
          style={{
            fontSize: '14px',
            lineHeight: 1.55,
            maxWidth: '320px',
          }}
        >
          Ask me anything about the venue or tell me about your dream wedding and I'll help you figure out if we're a fit.
        </p>
      )}
    </div>
  );
}