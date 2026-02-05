import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Maximize2, Volume2, VolumeX } from 'lucide-react';

export default function ChatVideoMessage({ videoId, label, onExpand }) {
  const [isMuted, setIsMuted] = useState(false);
  const playerRef = useRef(null);

  useEffect(() => {
    if (!videoId) return;

    // Load Wistia script if not already loaded
    if (!document.querySelector('script[src*="wistia.com/assets/external/E-v1.js"]')) {
      const script = document.createElement('script');
      script.src = 'https://fast.wistia.com/assets/external/E-v1.js';
      script.async = true;
      document.head.appendChild(script);
    }

    // Initialize player
    const initPlayer = () => {
      window._wq = window._wq || [];
      window._wq.push({
        id: videoId,
        onReady: (video) => {
          playerRef.current = video;
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
  }, [videoId]);

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

      {/* Video Player */}
      <div className="max-w-[75%] md:max-w-[65%]">
        <div className="relative rounded-2xl overflow-hidden bg-stone-900 shadow-lg group">
          {/* Wistia Embed */}
          <div
            className={`wistia_embed wistia_async_${videoId} videoFoam=false`}
            style={{ width: '100%', aspectRatio: '16/9' }}
          />
          
          {/* Control Buttons Overlay */}
          <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
        </div>

        {/* Label below video */}
        {label && (
          <p className="text-sm text-stone-600 mt-2 px-2">
            {label}
          </p>
        )}
      </div>
    </motion.div>
  );
}