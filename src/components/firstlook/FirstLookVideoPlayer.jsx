import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function FirstLookVideoPlayer({
  videoId,
  autoPlay = true,
  muted = true,
  loop = false,
  fitStrategy = 'cover',
  showControls = false,
  onReady,
  onEnd,
  onPlay,
  onPause,
  className = ''
}) {
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [progress, setProgress] = useState(0);
  const [showUnmuteHint, setShowUnmuteHint] = useState(muted && autoPlay);
  const playerRef = useRef(null);

  // Load Wistia script
  useEffect(() => {
    if (!document.querySelector('script[src*="wistia.com/assets/external/E-v1.js"]')) {
      const script = document.createElement('script');
      script.src = 'https://fast.wistia.com/assets/external/E-v1.js';
      script.async = true;
      document.head.appendChild(script);
    }

    // Add CSS to hide Wistia's native overlays
    const styleId = 'firstlook-wistia-overrides';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
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
      document.head.appendChild(style);
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.remove();
        playerRef.current = null;
      }
    };
  }, []);

  // Initialize player
  useEffect(() => {
    if (!videoId) return;

    const initPlayer = () => {
      window._wq = window._wq || [];
      window._wq.push({
        id: videoId,
        onReady: (video) => {
          playerRef.current = video;
          
          if (muted) {
            video.mute();
          } else {
            video.unmute();
          }

          if (autoPlay) {
            video.play();
          }

          if (loop) {
            video.bind('end', () => {
              video.time(0);
              video.play();
            });
          } else if (onEnd) {
            video.bind('end', onEnd);
          }

          // Track progress
          video.bind('timechange', (t) => {
            const duration = video.duration();
            if (duration > 0) {
              setProgress((t / duration) * 100);
            }
          });

          // Track play/pause state
          video.bind('play', () => {
            setIsPlaying(true);
            onPlay?.();
          });

          video.bind('pause', () => {
            setIsPlaying(false);
            onPause?.();
          });

          onReady?.(video);
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
  }, [videoId, muted, autoPlay, loop, onReady, onEnd, onPlay, onPause]);

  // Auto-hide unmute hint
  useEffect(() => {
    if (showUnmuteHint) {
      const timer = setTimeout(() => setShowUnmuteHint(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showUnmuteHint]);

  const togglePlayPause = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pause();
    } else {
      playerRef.current.play();
    }
  };

  const handleUnmute = () => {
    if (playerRef.current) {
      playerRef.current.unmute();
      if (!isPlaying) {
        playerRef.current.play();
      }
    }
    setIsMuted(false);
    setShowUnmuteHint(false);
  };

  const handleMute = () => {
    if (playerRef.current) {
      playerRef.current.mute();
    }
    setIsMuted(true);
  };

  const handleProgressClick = (e) => {
    if (!playerRef.current) return;
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const duration = playerRef.current.duration();
    playerRef.current.time(percentage * duration);
  };

  return (
    <div className={`relative ${className}`} onClick={showControls ? togglePlayPause : undefined}>
      {/* Wistia video container */}
      <div className="w-full h-full bg-black">
        <div
          className={`wistia_embed wistia_async_${videoId} wistiaFitStrategy=${fitStrategy} videoFoam=false autoPlay=${autoPlay} playbar=false controlsVisibleOnLoad=false settingsControl=false fullscreenButton=false playButton=false smallPlayButton=false volumeControl=false playPauseNotifier=false ${muted ? 'muted=true silentAutoPlay=true' : ''} ${loop ? 'endVideoBehavior=loop' : ''}`}
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {showControls && (
        <>
          {/* Mute/Unmute Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              isMuted ? handleUnmute() : handleMute();
            }}
            className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors z-10"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          {/* Tap to Unmute Hint */}
          <AnimatePresence>
            {isMuted && showUnmuteHint && (
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

          {/* Play/Pause Overlay */}
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

          {/* Progress Bar */}
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
        </>
      )}
    </div>
  );
}