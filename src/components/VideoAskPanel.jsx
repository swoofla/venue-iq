import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, ChevronLeft, MessageCircle } from 'lucide-react';

const videoOptions = [
  { id: 'planner', label: 'Meet Your Planners', videoId: 'dQw4w9WgXcQ' },
  { id: 'packages', label: 'Learn About Packages', videoId: 'dQw4w9WgXcQ' },
  { id: 'tour', label: 'Quick Mini Tour', videoId: 'dQw4w9WgXcQ' },
];

export default function VideoAskPanel() {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);

  if (!isOpen) {
    return (
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-black rounded-full shadow-lg flex items-center justify-center text-white hover:bg-stone-800 transition-colors z-50"
      >
        <MessageCircle className="w-6 h-6" />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.9 }}
      className="fixed bottom-6 right-6 w-[340px] h-[600px] bg-stone-900 rounded-3xl shadow-2xl overflow-hidden z-50"
    >
      <AnimatePresence mode="wait">
        {selectedVideo ? (
          <motion.div
            key="video"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full flex flex-col"
          >
            <div className="p-4 flex items-center gap-2">
              <button
                onClick={() => setSelectedVideo(null)}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-white font-medium">{videoOptions.find(v => v.id === selectedVideo)?.label}</span>
            </div>
            <div className="flex-1 px-4 pb-4">
              <div className="w-full h-full rounded-2xl overflow-hidden bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${videoOptions.find(v => v.id === selectedVideo)?.videoId}?autoplay=1`}
                  title="Video"
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full relative"
          >
            {/* Background Image with Gradient Overlay */}
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%), url('https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80')`,
              }}
            />

            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Content */}
            <div className="absolute inset-0 flex flex-col justify-end p-6">
              <div className="mb-6">
                <h3 className="text-white text-2xl font-semibold mb-2">Hi, I'm Nadine</h3>
                <p className="text-white/80 text-sm">Owner and head planner here at Sugar Lake, let me show you around.</p>
              </div>

              <div className="space-y-3">
                {videoOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setSelectedVideo(option.id)}
                    className="w-full px-5 py-4 bg-white/10 backdrop-blur-sm rounded-2xl text-white font-medium text-left hover:bg-white/20 transition-all flex items-center justify-between group"
                  >
                    {option.label}
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                      <Play className="w-4 h-4 ml-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}