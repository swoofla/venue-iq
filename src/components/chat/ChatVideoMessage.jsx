import React from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';

export default function ChatVideoMessage({ videoId, label, thumbnailUrl, onClick }) {
  // Use Wistia's auto-thumbnail if no custom thumbnail provided
  const thumbnail = thumbnailUrl || `https://fast.wistia.com/embed/medias/${videoId}/swatch`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 justify-start mb-3"
    >
      {/* Bot Avatar */}
      <div className="h-7 w-7 rounded-lg bg-stone-100 flex items-center justify-center mt-0.5 flex-shrink-0">
        <div className="h-1.5 w-1.5 rounded-full bg-stone-400" />
      </div>

      {/* Video Bubble */}
      <button
        onClick={onClick}
        className="max-w-[75%] group cursor-pointer"
      >
        {/* Thumbnail with play overlay */}
        <div className="relative rounded-2xl overflow-hidden bg-stone-900 aspect-video shadow-lg">
          <img
            src={thumbnail}
            alt={label}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {/* Dark overlay on hover */}
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
          
          {/* Play button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-white/90 group-hover:bg-white flex items-center justify-center transition-all shadow-lg">
              <Play className="w-6 h-6 text-black ml-0.5" />
            </div>
          </div>
        </div>

        {/* Label below thumbnail */}
        {label && (
          <p className="text-sm text-stone-600 mt-2 px-2">
            {label}
          </p>
        )}
      </button>
    </motion.div>
  );
}