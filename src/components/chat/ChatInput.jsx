import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export default function ChatInput({ onSend, disabled, placeholder = "Type your message..." }) {
  const [message, setMessage] = useState('');
  const inputRef = useRef(null);

  // Keep the cursor in the input across sends — re-focus whenever the input
  // becomes enabled again (after the bot finishes typing / a flow closes).
  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
      inputRef.current?.focus();
    }
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
          onChange={(e) => setMessage(e.target.value)}
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