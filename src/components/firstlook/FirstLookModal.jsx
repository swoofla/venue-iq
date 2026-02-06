import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft } from 'lucide-react';
import FirstLookVideoPlayer from './FirstLookVideoPlayer';

export default function FirstLookModal({ videoId, title, startTime, wasMuted, onClose, onBack }) {
  if (!videoId) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black"
      >
        {/* Header with back/close button */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between gap-2 z-10 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                onClick={onBack}
                className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {title && (
              <span className="text-white font-medium text-sm">
                {title}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player */}
        <FirstLookVideoPlayer
          videoId={videoId}
          autoPlay={true}
          muted={wasMuted || false}
          loop={false}
          fitStrategy="cover"
          showControls={true}
          startTime={startTime || 0}
          className="w-full h-full"
        />
      </motion.div>
    </AnimatePresence>
  );
}