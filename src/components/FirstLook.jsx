import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Pause, ChevronLeft, Volume2, VolumeX } from 'lucide-react';

export default function FirstLook({ config }) {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showUnmuteHint, setShowUnmuteHint] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const welcomePlayerRef = useRef(null);
  const selectedPlayerRef = useRef(null);

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

  // Load Wistia script once
  useEffect(() => {
    if (!document.querySelector('script[src*="wistia.com/assets/external/E-v1.js"]')) {
      const script = document.createElement('script');
      script.src = 'https://fast.wistia.com/assets/external/E-v1.js';
      script.async = true;
      document.head.appendChild(script);
    }
    
    // Add CSS to hide Wistia's native overlays
    const style = document.createElement('style');
    style.id = 'firstlook-wistia-overrides';
    style.textContent = `
      .wistia_click_to_play,
      .w-big-play-button,
      .w-playbar,
      .w-control-bar,
      .w-vulcan-v2-button,
      .w-css-reset-tree button,
      .wistia_placeholderImage_overlay {
        display: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;
    if (!document.getElementById('firstlook-wistia-overrides')) {
      document.head.appendChild(style);
    }
    
    return () => {
      const existingStyle = document.getElementById('firstlook-wistia-overrides');
      if (existingStyle) existingStyle.remove();
    };
  }, []);

  // Initialize welcome video player
  useEffect(() => {
    if (!settings.welcome_video_id || !isOpen || selectedVideo) return;

    const initPlayer = () => {
      window._wq = window._wq || [];
      window._wq.push({
        id: settings.welcome_video_id,
        onReady: (video) => {
          welcomePlayerRef.current = video;
          video.mute();
          video.play();
        }
      });
    };

    if (window.Wistia) {
      initPlayer();
    } else {
      const checkWistia = setInterval(() => {
        if (window.Wistia) {
          clearInterval(checkWistia);
          initPlayer();
        }
      }, 100);
      return () => clearInterval(checkWistia);
    }
  }, [settings.welcome_video_id, isOpen, selectedVideo]);

  // Initialize selected video player
  useEffect(() => {
    if (!selectedVideo) {
      selectedPlayerRef.current = null;
      setProgress(0);
      setIsPlaying(true);
      return;
    }

    const videoId = settings.video_options?.find(v => v.id === selectedVideo)?.video_id;
    if (!videoId) return;

    const initSelectedPlayer = () => {
      window._wq = window._wq || [];
      window._wq.push({
        id: videoId,
        onReady: (video) => {
          selectedPlayerRef.current = video;
          video.unmute();
          video.play();
          setIsPlaying(true);

          // Track progress
          video.bind('timechange', (t) => {
            const duration = video.duration();
            if (duration > 0) {
              setProgress((t / duration) * 100);
            }
          });

          // Handle video end
          video.bind('end', () => {
            setIsPlaying(false);
            setProgress(100);
          });
        }
      });
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (window.Wistia) {
        initSelectedPlayer();
      } else {
        const checkWistia = setInterval(() => {
          if (window.Wistia) {
            clearInterval(checkWistia);
            initSelectedPlayer();
          }
        }, 100);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [selectedVideo, settings.video_options]);

  // Pause welcome video when selecting a video
  useEffect(() => {
    if (selectedVideo && welcomePlayerRef.current) {
      welcomePlayerRef.current.pause();
    } else if (!selectedVideo && welcomePlayerRef.current && isOpen) {
      welcomePlayerRef.current.play();
    }
  }, [selectedVideo, isOpen]);

  const handleUnmute = () => {
    if (welcomePlayerRef.current) {
      welcomePlayerRef.current.unmute();
      welcomePlayerRef.current.play();
    }
    setIsMuted(false);
    setShowUnmuteHint(false);
  };

  const handleMute = () => {
    if (welcomePlayerRef.current) {
      welcomePlayerRef.current.mute();
    }
    setIsMuted(true);
  };

  const togglePlayPause = () => {
    if (!selectedPlayerRef.current) return;
    
    if (isPlaying) {
      selectedPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      selectedPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleProgressClick = (e) => {
    if (!selectedPlayerRef.current) return;
    
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const duration = selectedPlayerRef.current.duration();
    
    selectedPlayerRef.current.time(percentage * duration);
    setProgress(percentage * 100);
  };

  // Auto-hide unmute hint after 5 seconds
  useEffect(() => {
    if (showUnmuteHint && isOpen && !selectedVideo) {
      const timer = setTimeout(() => setShowUnmuteHint(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showUnmuteHint, isOpen, selectedVideo]);

  if (!settings.is_enabled) return null;

  // Collapsed state
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
            onClick={togglePlayPause}
          >
            {/* Header with back button */}
            <div className="absolute top-0 left-0 right-0 p-4 flex items-center gap-2 z-10 bg-gradient-to-b from-black/60 to-transparent">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (selectedPlayerRef.current) {
                    selectedPlayerRef.current.pause();
                  }
                  setSelectedVideo(null);
                  setIsMuted(true);
                  setShowUnmuteHint(true);
                }}
                className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-white font-medium text-sm">
                {settings.video_options?.find(v => v.id === selectedVideo)?.label}
              </span>
            </div>
            
            {/* Wistia video container */}
            <div className="w-full h-full bg-black">
              <div
                className={`wistia_embed wistia_async_${settings.video_options?.find(v => v.id === selectedVideo)?.video_id} wistiaFitStrategy=cover videoFoam=false autoPlay=true playbar=false controlsVisibleOnLoad=false settingsControl=false fullscreenButton=false playButton=false smallPlayButton=false volumeControl=false playPauseNotifier=false`}
                style={{ width: '100%', height: '100%' }}
              />
            </div>

            {/* Custom play/pause overlay - shows when paused */}
            <AnimatePresence>
              {!isPlaying && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center bg-black/30 z-10"
                  onClick={togglePlayPause}
                >
                  <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Play className="w-8 h-8 text-white ml-1" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Custom progress bar */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent z-10">
              <div 
                className="w-full h-1 bg-white/30 rounded-full cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleProgressClick(e);
                }}
              >
                <div 
                  className="h-full bg-white rounded-full transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </motion.div>
        ) : (
          /* ===== WELCOME MENU VIEW ===== */
          <motion.div
            key="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full relative cursor-pointer"
            onClick={() => {
              if (isMuted && settings.welcome_video_id) {
                handleUnmute();
              }
            }}
          >
            {/* Background: Wistia video */}
            <div className="absolute inset-0">
              {settings.welcome_video_id ? (
                <div
                  className={`wistia_embed wistia_async_${settings.welcome_video_id} wistiaFitStrategy=cover videoFoam=false autoPlay=true silentAutoPlay=true endVideoBehavior=loop playbar=false controlsVisibleOnLoad=false settingsControl=false fullscreenButton=false playButton=false smallPlayButton=false volumeControl=false muted=true`}
                  style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
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
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70 pointer-events-none" />
            </div>

            {/* Close Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Mute/Unmute Button */}
            {settings.welcome_video_id && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  isMuted ? handleUnmute() : handleMute();
                }}
                className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors z-10"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            )}

            {/* Tap to Unmute Hint */}
            <AnimatePresence>
              {isMuted && showUnmuteHint && settings.welcome_video_id && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute top-16 left-4 z-10"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnmute();
                    }}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        option.video_id && setSelectedVideo(option.id);
                      }}
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