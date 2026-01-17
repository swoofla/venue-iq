import React from 'react';
import { motion } from 'framer-motion';

export default function ChatMessage({ message, isBot }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-4`}
    >
      {isBot && (
        <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center mr-3 flex-shrink-0">
          <span className="text-stone-700 font-semibold text-sm">E</span>
        </div>
      )}
      <div
        className={`max-w-[75%] px-5 py-3 ${
          isBot
            ? 'bg-white text-stone-800 shadow-sm border border-stone-100'
            : 'bg-black text-white'
        } rounded-2xl`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message}</p>
      </div>
    </motion.div>
  );
}