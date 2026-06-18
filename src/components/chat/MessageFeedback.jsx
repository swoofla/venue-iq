import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

// Per-message feedback control for internal testing.
// onSubmit({ rating, comment }) should persist the feedback and resolve true/false.
export default function MessageFeedback({ onSubmit }) {
  const [state, setState] = useState('idle'); // idle | commenting | sending | done
  const [comment, setComment] = useState('');

  const send = async (rating, c) => {
    setState('sending');
    const ok = await onSubmit({ rating, comment: c });
    setState(ok ? 'done' : 'idle');
  };

  if (state === 'done') {
    return <p className="mt-1 text-xs text-gray-400">Thanks for the feedback!</p>;
  }

  if (state === 'commenting') {
    return (
      <div className="mt-2 w-full max-w-sm">
        <textarea
          autoFocus
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What didn't work? (optional)"
          rows={3}
          className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
        <div className="mt-1 flex gap-2">
          <button onClick={() => send('down', comment)} className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white active:opacity-80">Send</button>
          <button onClick={() => { setState('idle'); setComment(''); }} className="rounded-lg px-3 py-1.5 text-sm text-gray-500 active:opacity-80">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-1">
      <button aria-label="Good response" disabled={state === 'sending'} onClick={() => send('up', '')} className="rounded-md p-2 text-gray-400 hover:text-gray-700 active:scale-95">
        <ThumbsUp className="h-4 w-4" />
      </button>
      <button aria-label="Bad response" disabled={state === 'sending'} onClick={() => setState('commenting')} className="rounded-md p-2 text-gray-400 hover:text-gray-700 active:scale-95">
        <ThumbsDown className="h-4 w-4" />
      </button>
    </div>
  );
}