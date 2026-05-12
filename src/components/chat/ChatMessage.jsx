import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export default function ChatMessage({ message, isBot }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-4`}
    >
      {isBot && (
        <div
          className="rounded-full bg-stone-100 flex items-center justify-center mr-2 flex-shrink-0"
          style={{ width: '26px', height: '26px' }}
        >
          <Sparkles style={{ width: '13px', height: '13px' }} className="text-stone-600" />
        </div>
      )}
      <div
        className={`max-w-[75%] ${
          isBot ? 'bg-stone-50 text-stone-900 border border-stone-200' : 'bg-black text-white'
        }`}
        style={{
          padding: '9px 13px',
          fontSize: '13px',
          lineHeight: 1.45,
          borderRadius: isBot ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
          borderWidth: isBot ? '0.5px' : 0,
        }}
      >
        <p className="whitespace-pre-wrap" style={{ margin: 0 }}>{message}</p>
      </div>
    </motion.div>
  );
}