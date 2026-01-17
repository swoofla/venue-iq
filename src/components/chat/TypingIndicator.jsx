import React from 'react';
import { motion } from 'framer-motion';

export default function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center mr-3 flex-shrink-0">
        <span className="text-stone-700 font-semibold text-sm">E</span>
      </div>
      <div className="bg-white shadow-sm border border-stone-100 rounded-2xl px-5 py-4 flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-stone-400 rounded-full"
            animate={{ y: [0, -6, 0] }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
            }}
          />
        ))}
      </div>
    </div>
  );
}