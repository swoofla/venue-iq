import React, { useState } from 'react';
import { Send } from 'lucide-react';

export default function ChatInput({ onSend, disabled, placeholder = "Type your message..." }) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-stone-200 bg-white">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 px-4 py-3 bg-stone-50 border border-stone-200 rounded-full text-base focus:outline-none focus:ring-2 focus:ring-stone-300 focus:border-transparent transition-all disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !message.trim()}
          className="w-11 h-11 bg-black text-white rounded-full flex items-center justify-center hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}