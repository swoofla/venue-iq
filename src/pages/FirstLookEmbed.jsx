import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import FirstLookWelcomeScreen from '@/components/firstlook/FirstLookWelcomeScreen';
import FirstLookModal from '@/components/firstlook/FirstLookModal';

export default function FirstLookEmbed() {
  const [venueSlug, setVenueSlug] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('venue');
    setVenueSlug(slug);
  }, []);

  const { data: venue, isLoading: venueLoading } = useQuery({
    queryKey: ['venue-by-slug', venueSlug],
    queryFn: async () => {
      if (!venueSlug) return null;
      const venues = await base44.entities.Venue.filter({ slug: venueSlug });
      return venues[0] || null;
    },
    enabled: !!venueSlug
  });

  const { data: firstLookConfig, isLoading: configLoading } = useQuery({
    queryKey: ['firstlook-config', venue?.id],
    queryFn: async () => {
      if (!venue?.id) return null;
      const configs = await base44.entities.FirstLookConfiguration.filter({ venue_id: venue.id });
      return configs[0] || null;
    },
    enabled: !!venue?.id
  });

  if (venueLoading || configLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-stone-900">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!venue || !firstLookConfig || !firstLookConfig.is_enabled) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-stone-900 p-6">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-stone-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Not Available</h2>
          <p className="text-stone-400">
            First Look is not enabled for this venue.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen overflow-hidden" style={{ colorScheme: 'dark' }}>
      {selectedVideo ? (
        <FirstLookModal
          videoId={selectedVideo.video_id}
          title={selectedVideo.label}
          onBack={() => setSelectedVideo(null)}
          onClose={() => setSelectedVideo(null)}
        />
      ) : (
        <div className="w-full h-full">
          <FirstLookWelcomeScreen
            config={firstLookConfig}
            onSelectVideo={(option) => setSelectedVideo(option)}
            onClose={() => {
              // In embed mode, there's nowhere to close to
              // Optionally could collapse or show a message
            }}
          />
        </div>
      )}
    </div>
  );
}