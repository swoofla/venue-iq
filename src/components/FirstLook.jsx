import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, ChevronLeft, Volume2, VolumeX } from 'lucide-react';

export default function FirstLook({ config }) {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showUnmuteHint, setShowUnmuteHint] = useState(true);

  const defaultConfig = {
    is_enabled: true,
    welcome_video_id: '',
    welcome_video_thumbnail: '',
    host_name: 'Your Host',
    host_title: 'Owner & Head Planner',
    welcome_text: 'let me show you around.',
    video_options: []
  };

  const settings = config || defaultConfig;

  // Build Wistia iframe URL with parameters
  const getWistiaEmbedUrl = (videoId, options = {}) => {
    if (!videoId) return '';
    
    const {
      autoPlay = true,
      muted = true,
      loop = true,
      controls = false
    } = options;
    
    const params = new URLSearchParams({
      autoPlay: autoPlay.toString(),
      silentAutoPlay: 'true',
      muted: muted.toString(),
      endVideoBehavior: loop ? 'loop' : 'default',
      playbar: controls.toString(),
      controlsVisibleOnLoad: controls.toString(),
      settingsControl: 'false',
      fullscreenButton: controls.toString(),
      playButton: 'false',
      smallPlayButton: 'false',
      volumeControl: controls.toString(),
      fitStrategy: 'cover',
      videoFoam: 'false'
    });
    
    return `https://fast.wistia.net/embed/iframe/${videoId}?${params.toString()}`;
  };

  const handleUnmute = () => {
    setIsMuted(false);
    setShowUnmuteHint(false);
  };

  const handleMute = () => {
    setIsMuted(true);
  };

  // Auto-hide unmute hint after 5 seconds
  useEffect(() => {
    if (showUnmuteHint && isOpen && !selectedVideo) {
      const timer = setTimeout(() => setShowUnmuteHint(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showUnmuteHint, isOpen, selectedVideo]);

  if (!settings.is_enabled) return null;

  // Collapsed state - just show play button
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
          /* ===== SELECTED VIDEO PLAYER VIEW ===== */
          <motion.div
            key="video"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full flex flex-col relative"
          >
            {/* Header with back button */}
            <div className="absolute top-0 left-0 right-0 p-4 flex items-center gap-2 z-10 bg-gradient-to-b from-black/60 to-transparent">
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
            
            {/* Full video player with controls */}
            <div className="w-full h-full bg-black">
              <iframe
                src={getWistiaEmbedUrl(
                  settings.video_options?.find(v => v.id === selectedVideo)?.video_id,
                  { autoPlay: true, muted: false, loop: false, controls: true }
                )}
                className="w-full h-full"
                allow="autoplay; fullscreen"
                allowFullScreen
                frameBorder="0"
                title="Video player"
              />
            </div>
          </motion.div>
        ) : (
          /* ===== WELCOME MENU VIEW ===== */
          <motion.div
            key="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full relative"
          >
            {/* Background: Wistia video embed OR fallback image */}
            <div className="absolute inset-0">
              {settings.welcome_video_id ? (
                <iframe
                  key={`welcome-${isMuted}`}
                  src={getWistiaEmbedUrl(settings.welcome_video_id, {
                    autoPlay: true,
                    muted: isMuted,
                    loop: true,
                    controls: false
                  })}
                  className="w-full h-full"
                  style={{ pointerEvents: 'none' }}
                  allow="autoplay"
                  frameBorder="0"
                  title="Welcome video"
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
              {/* Gradient overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70 pointer-events-none" />
            </div>

            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Mute/Unmute Button - only show if there's a welcome video */}
            {settings.welcome_video_id && (
              <button
                onClick={isMuted ? handleUnmute : handleMute}
                className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors z-10"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            )}

            {/* Tap to Unmute Hint - auto-hides after 5 seconds */}
            <AnimatePresence>
              {isMuted && showUnmuteHint && settings.welcome_video_id && (
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
              {/* Host intro text */}
              <div className="mb-5">
                <h3 className="text-white text-xl font-semibold mb-1">
                  Hi, I'm {settings.host_name}
                </h3>
                <p className="text-white/80 text-sm">
                  {settings.host_title}, {settings.welcome_text}
                </p>
              </div>

              {/* Video menu options */}
              {settings.video_options && settings.video_options.length > 0 && (
                <div className="space-y-2.5">
                  {settings.video_options.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => option.video_id && setSelectedVideo(option.id)}
                      disabled={!option.video_id}
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

              {/* Branding */}
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