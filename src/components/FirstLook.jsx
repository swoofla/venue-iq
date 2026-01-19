import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, ChevronLeft, Volume2, VolumeX } from 'lucide-react';

export default function FirstLook({ config }) {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showUnmuteHint, setShowUnmuteHint] = useState(true);
  const menuVideoRef = useRef(null);

  const defaultConfig = {
    is_enabled: true,
    welcome_video_url: '',
    welcome_video_thumbnail: '',
    host_name: 'Your Host',
    host_title: 'Owner & Head Planner',
    welcome_text: 'let me show you around.',
    video_options: []
  };

  const settings = config || defaultConfig;

  const handleUnmute = () => {
    setIsMuted(false);
    setShowUnmuteHint(false);
    if (menuVideoRef.current) {
      menuVideoRef.current.muted = false;
      menuVideoRef.current.currentTime = 0;
      menuVideoRef.current.play();
    }
  };

  const handleMute = () => {
    setIsMuted(true);
    if (menuVideoRef.current) {
      menuVideoRef.current.muted = true;
    }
  };

  useEffect(() => {
    if (showUnmuteHint && isOpen && !selectedVideo) {
      const timer = setTimeout(() => setShowUnmuteHint(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showUnmuteHint, isOpen, selectedVideo]);

  if (!settings.is_enabled) return null;

  if (!isOpen) {
    return (
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-black rounded-full shadow-lg flex items-center justify-center text-white hover:bg-stone-800 transition-colors z-50"
        aria-label="Open First Look"
      >
        <Play className="w-6 h-6 ml-0.5" />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.9 }}
      className="fixed bottom-6 right-6 w-[320px] h-[568px] bg-stone-900 rounded-3xl shadow-2xl overflow-hidden z-50"
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
            <div className="absolute top-0 left-0 right-0 p-4 flex items-center gap-2 z-10 bg-gradient-to-b from-black/50 to-transparent">
              <button
                onClick={() => setSelectedVideo(null)}
                className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-white font-medium text-sm">
                {settings.video_options?.find(v => v.id === selectedVideo)?.label}
              </span>
            </div>
            
            <div className="w-full h-full bg-black">
              <video
                src={settings.video_options?.find(v => v.id === selectedVideo)?.video_url}
                className="w-full h-full object-cover"
                controls
                autoPlay
                playsInline
              />
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
            {/* Background: Muted autoplay video OR fallback image */}
            <div className="absolute inset-0">
              {settings.welcome_video_url ? (
                <video
                  ref={menuVideoRef}
                  src={settings.welcome_video_url}
                  className="w-full h-full object-cover"
                  autoPlay
                  loop
                  muted={isMuted}
                  playsInline
                  poster={settings.welcome_video_thumbnail}
                />
              ) : settings.welcome_video_thumbnail ? (
                <img 
                  src={settings.welcome_video_thumbnail} 
                  className="w-full h-full object-cover" 
                  alt="Welcome"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-b from-stone-700 to-stone-900" />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
            </div>

            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Mute/Unmute Button - only show if there's a welcome video */}
            {settings.welcome_video_url && (
              <button
                onClick={isMuted ? handleUnmute : handleMute}
                className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors z-10"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            )}

            {/* Tap to Unmute Hint - auto-hides after 5 seconds */}
            <AnimatePresence>
              {isMuted && showUnmuteHint && settings.welcome_video_url && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute top-16 left-4 z-10"
                >
                  <button
                    onClick={handleUnmute}
                    className="flex items-center gap-2 px-3 py-2 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs font-medium animate-pulse"
                  >
                    <VolumeX className="w-4 h-4" />
                    Tap to unmute
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Content - Bottom section */}
            <div className="absolute inset-0 flex flex-col justify-end p-5">
              <div className="mb-5">
                <h3 className="text-white text-xl font-semibold mb-1">
                  Hi, I'm {settings.host_name}
                </h3>
                <p className="text-white/80 text-sm">
                  {settings.host_title}, {settings.welcome_text}
                </p>
              </div>

              {settings.video_options && settings.video_options.length > 0 && (
                <div className="space-y-2.5">
                  {settings.video_options.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => option.video_url && setSelectedVideo(option.id)}
                      disabled={!option.video_url}
                      className="w-full px-4 py-3.5 bg-white/10 backdrop-blur-sm rounded-2xl text-white font-medium text-left hover:bg-white/20 transition-all flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="text-sm">{option.label}</span>
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                        <Play className="w-4 h-4 ml-0.5" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <p className="text-center text-white/40 text-xs mt-4 font-medium tracking-wide">
                FIRST LOOK
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}