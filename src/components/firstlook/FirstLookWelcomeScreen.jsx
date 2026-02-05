import React from 'react';
import { motion } from 'framer-motion';
import { X, Play } from 'lucide-react';
import FirstLookVideoPlayer from './FirstLookVideoPlayer';

export default function FirstLookWelcomeScreen({ config, onSelectVideo, onClose }) {
  const defaultConfig = {
    welcome_video_id: '',
    welcome_video_thumbnail: '',
    host_name: 'Your Host',
    host_title: 'Owner & Head Planner',
    welcome_text: 'let me show you around.',
    video_options: []
  };

  const settings = config || defaultConfig;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full h-full relative"
    >
      {/* Background: Wistia video or image */}
      <div className="absolute inset-0">
        {settings.welcome_video_id ? (
          <FirstLookVideoPlayer
            videoId={settings.welcome_video_id}
            autoPlay={true}
            muted={true}
            loop={true}
            fitStrategy="cover"
            showControls={false}
            className="w-full h-full"
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
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors z-10"
      >
        <X className="w-5 h-5" />
      </button>

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
                onClick={() => option.video_id && onSelectVideo(option)}
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
  );
}