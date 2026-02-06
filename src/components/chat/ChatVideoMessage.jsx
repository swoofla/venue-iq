import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Maximize2, Volume2, VolumeX } from 'lucide-react';

export default function ChatVideoMessage({ videoId, label, onExpand, aspectRatio = 'portrait' }) {
  const [isMuted, setIsMuted] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const playerRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!videoId) return;

    if (!document.querySelector('script[src*="wistia.com/assets/external/E-v1.js"]')) {
      const script = document.createElement('script');
      script.src = 'https://fast.wistia.com/assets/external/E-v1.js';
      script.async = true;
      document.head.appendChild(script);
    }

    const initPlayer = () => {
      window._wq = window._wq || [];
      window._wq.push({
        id: videoId,
        options: {
          playerColor: '000000',
          controlsVisibleOnLoad: false,
          playbar: true,
          smallPlayButton: true,
          settingsControl: false,
          fullscreenButton: false,
          volumeControl: false,
          fitStrategy: 'contain',
          silentAutoPlay: false,
          videoFoam: false,
        },
        onReady: (video) => {
          playerRef.current = video;
          setPlayerReady(true);
          video.unmute();
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
  }, [videoId, aspectRatio]);

  const toggleMute = () => {
    if (playerRef.current) {
      if (isMuted) {
        playerRef.current.unmute();
      } else {
        playerRef.current.mute();
      }
      setIsMuted(!isMuted);
    }
  };

  const getAspectStyle = () => {
    if (aspectRatio === 'portrait') return { aspectRatio: '9/16' };
    if (aspectRatio === 'square') return { aspectRatio: '1/1' };
    if (aspectRatio === 'landscape') return { aspectRatio: '16/9' };
    return { aspectRatio: '9/16' }; // default to portrait
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 justify-start mb-3"
    >
      <div className="h-7 w-7 rounded-lg bg-stone-100 flex items-center justify-center mt-0.5 flex-shrink-0">
        <div className="h-1.5 w-1.5 rounded-full bg-stone-400" />
      </div>

      <div className="max-w-[260px] md:max-w-[280px]">
        <div
          ref={containerRef}
          className="relative rounded-2xl overflow-hidden bg-stone-900 shadow-lg group"
          style={getAspectStyle()}
        >
          <div
            className={`wistia_embed wistia_async_${videoId} playerColor=000000`}
            style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
          />

          <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 md:group-hover:opacity-100 transition-opacity z-10">
            <button
              onClick={toggleMute}
              className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => onExpand?.({ videoId, title: label })}
              className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors"
              title="Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          <div
            className="absolute inset-0 z-[5] md:hidden"
            onClick={(e) => {
              const overlay = e.currentTarget.previousElementSibling;
              if (overlay) {
                overlay.classList.toggle('opacity-0');
                overlay.classList.toggle('opacity-100');
              }
            }}
          />
        </div>

        {label && (
          <p className="text-sm text-stone-600 mt-2 px-1 flex items-center gap-1.5">
            <span>🎥</span> {label}
          </p>
        )}
      </div>
    </motion.div>
  );
}