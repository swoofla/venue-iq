import React from 'react';
import { Sparkles } from 'lucide-react';

export default function ChatEmptyState({ venueName }) {
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
        Hi, I'm {venueName}'s virtual planner
      </h2>
      <p
        className="text-stone-500 text-center"
        style={{
          fontSize: '14px',
          lineHeight: 1.55,
          maxWidth: '260px',
        }}
      >
        Tell me about your wedding and I'll help you figure out if we're a fit.
      </p>
    </div>
  );
}