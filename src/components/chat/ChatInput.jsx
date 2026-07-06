import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export default function ChatInput({ onSend, disabled, placeholder = "Type your message..." }) {
  const [message, setMessage] = useState('');
  const inputRef = useRef(null);
  // Track whether the user has interacted at all. We must NOT autofocus on
  // initial mount, because the app runs inside an iframe on venue websites —
  // focusing an input triggers the browser to scroll the host page to bring
  // it into view, yanking the visitor down to the planner. Only refocus AFTER
  // the user has already engaged (typed or sent a message).
  const hasInteractedRef = useRef(false);

  // Keep the cursor in the input across sends — re-focus whenever the input
  // becomes enabled again (after the bot finishes typing / a flow closes),
  // but only once the user has interacted. Always use preventScroll so no
  // focus call can ever scroll the host page.
  useEffect(() => {
    if (!disabled && hasInteractedRef.current) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [disabled]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      hasInteractedRef.current = true;
      onSend(message.trim());
      setMessage('');
      inputRef.current?.focus({ preventScroll: true });
    }
  };

  const handleChange = (e) => {
    hasInteractedRef.current = true;
    setMessage(e.target.value);
  };

  const hasText = message.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="px-4 py-3 bg-white">
      <div
        className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-full"
        style={{ padding: '10px 14px', borderWidth: '0.5px' }}
      >
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent border-0 outline-none text-stone-900 placeholder:text-stone-400 disabled:opacity-50"
          style={{ fontSize: '16px' }}
        />
        <button
          type="submit"
          disabled={disabled || !hasText}
          aria-label="Send message"
          className="bg-black text-white rounded-full flex items-center justify-center transition-opacity"
          style={{
            width: '28px',
            height: '28px',
            opacity: !hasText || disabled ? 0.4 : 1,
            flexShrink: 0,
          }}
        >
          <ArrowUp style={{ width: '14px', height: '14px' }} />
        </button>
      </div>
    </form>
  );
}