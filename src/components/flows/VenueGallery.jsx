import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Camera, 
  Heart, 
  MapPin, 
  Sparkles,
  Home,
  Flower2,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';

// Category configuration with icons and labels
const CATEGORIES = [
  { id: 'ceremony', name: 'Ceremony Spaces', icon: Sparkles, description: 'Where your story begins' },
  { id: 'reception', name: 'Reception Hall', icon: Heart, description: 'Celebrate with loved ones' },
  { id: 'grounds', name: 'Venue Grounds', icon: MapPin, description: 'Stunning photo opportunities' },
  { id: 'details', name: 'Wedding Details', icon: Camera, description: 'The little things that matter' },
  { id: 'bridal_suite', name: 'Bridal Suite', icon: Home, description: 'Your private retreat' },
  { id: 'exterior', name: 'Exterior Views', icon: Flower2, description: 'First impressions' },
];

// Lightbox component for full-screen photo viewing
function Lightbox({ photo, onClose, onPrev, onNext, hasPrev, hasNext }) {
  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onPrev();
      if (e.key === 'ArrowRight' && hasNext) onNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white p-2 z-10"
        aria-label="Close"
      >
        <X className="w-8 h-8" />
      </button>
      
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 text-white/80 hover:text-white p-2 z-10"
          aria-label="Previous photo"
        >
          <ChevronLeft className="w-10 h-10" />
        </button>
      )}
      
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 text-white/80 hover:text-white p-2 z-10"
          aria-label="Next photo"
        >
          <ChevronRight className="w-10 h-10" />
        </button>
      )}
      
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="max-w-5xl max-h-[85vh] mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={photo.image_url}
          alt={photo.alt_text || photo.caption || 'Venue photo'}
          className="max-w-full max-h-[80vh] object-contain rounded-lg"
        />
        {photo.caption && (
          <p className="text-white/90 text-center mt-4 text-lg">{photo.caption}</p>
        )}
      </motion.div>
    </motion.div>
  );
}

// Category card component
function CategoryCard({ category, photos, onClick }) {
  const featuredPhoto = photos.find(p => p.is_featured) || photos[0];
  const Icon = category.icon;
  
  if (!featuredPhoto) return null;
  
  return (
    <motion.div
      whileHover={{ y: -4 }}
      onClick={onClick}
      className="relative group cursor-pointer rounded-xl overflow-hidden aspect-[4/3]"
    >
      <img
        src={featuredPhoto.image_url}
        alt={category.name}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      <div className="absolute bottom-3 left-3 right-3">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-4 h-4 text-white/90" />
          <span className="text-white font-medium text-sm">{category.name}</span>
        </div>
        <p className="text-white/60 text-xs">{photos.length} photos</p>
      </div>
    </motion.div>
  );
}

// Category detail view
function CategoryGallery({ category, photos, onBack, onPhotoClick }) {
  const Icon = category.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-stone-500 hover:text-stone-800 text-sm mb-4 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to categories
      </button>
      
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center">
          <Icon className="w-5 h-5 text-stone-600" />
        </div>
        <div>
          <h3 className="font-semibold text-stone-900">{category.name}</h3>
          <p className="text-sm text-stone-500">{category.description}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-1">
        {photos.map((photo, index) => (
          <motion.div
            key={photo.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="relative group cursor-pointer rounded-xl overflow-hidden aspect-[4/3]"
            onClick={() => onPhotoClick(photo, index)}
          >
            <img
              src={photo.image_url}
              alt={photo.alt_text || photo.caption || 'Venue photo'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="absolute bottom-2 left-2 right-2 text-white text-xs font-medium line-clamp-2">
                {photo.caption}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// Main Gallery Component
export default function VenueGallery({ venueId, onScheduleTour, onCancel }) {
  const [view, setView] = useState('main'); // 'main' or 'category'
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [currentPhotoSet, setCurrentPhotoSet] = useState([]);

  // Fetch photos from database
  const { data: photos = [], isLoading, error } = useQuery({
    queryKey: ['venuePhotos', venueId],
    queryFn: async () => {
      const allPhotos = await base44.entities.VenuePhoto.filter({ 
        venue_id: venueId,
        is_active: true 
      });
      // Sort by sort_order
      return allPhotos.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    },
    enabled: !!venueId
  });

  // Group photos by category
  const photosByCategory = React.useMemo(() => {
    const grouped = {};
    CATEGORIES.forEach(cat => {
      grouped[cat.id] = photos.filter(p => p.category === cat.id);
    });
    return grouped;
  }, [photos]);

  // Get categories that have photos
  const activeCategories = CATEGORIES.filter(cat => photosByCategory[cat.id]?.length > 0);

  const handleCategoryClick = (category) => {
    setSelectedCategory(category);
    setView('category');
  };

  const handlePhotoClick = (photo, index, photoSet) => {
    setLightboxPhoto(photo);
    setLightboxIndex(index);
    setCurrentPhotoSet(photoSet);
  };

  const handleLightboxPrev = () => {
    if (lightboxIndex > 0) {
      const newIndex = lightboxIndex - 1;
      setLightboxIndex(newIndex);
      setLightboxPhoto(currentPhotoSet[newIndex]);
    }
  };

  const handleLightboxNext = () => {
    if (lightboxIndex < currentPhotoSet.length - 1) {
      const newIndex = lightboxIndex + 1;
      setLightboxIndex(newIndex);
      setLightboxPhoto(currentPhotoSet[newIndex]);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border border-stone-100 mb-4 p-8"
      >
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
          <span className="text-stone-600">Loading gallery...</span>
        </div>
      </motion.div>
    );
  }

  // Error state
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border border-stone-100 mb-4 p-6"
      >
        <p className="text-red-600 text-center">Failed to load photos. Please try again.</p>
        <Button onClick={onCancel} variant="outline" className="w-full mt-4 rounded-full">
          Back to Chat
        </Button>
      </motion.div>
    );
  }

  // No photos state
  if (activeCategories.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border border-stone-100 mb-4 p-6"
      >
        <div className="text-center py-8">
          <ImageIcon className="w-12 h-12 text-stone-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-stone-900 mb-2">Gallery Coming Soon</h3>
          <p className="text-stone-600 mb-4">
            We're adding photos to our gallery. Schedule a tour to see the venue in person!
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={onCancel} variant="outline" className="flex-1 rounded-full">
            Back to Chat
          </Button>
          <Button onClick={onScheduleTour} className="flex-1 rounded-full bg-black hover:bg-stone-800">
            Schedule a Tour
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-sm border border-stone-100 mb-4 overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-stone-900 to-stone-800 px-5 py-4 text-white">
        <h2 className="text-lg font-semibold">Explore Our Venue</h2>
        <p className="text-white/70 text-sm mt-0.5">Discover your perfect wedding space</p>
      </div>

      <div className="p-5">
        <AnimatePresence mode="wait">
          {/* Main Category Grid View */}
          {view === 'main' && (
            <motion.div
              key="main"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="grid grid-cols-2 gap-3">
                {activeCategories.map((category, index) => (
                  <motion.div
                    key={category.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <CategoryCard
                      category={category}
                      photos={photosByCategory[category.id]}
                      onClick={() => handleCategoryClick(category)}
                    />
                  </motion.div>
                ))}
              </div>
              
              {/* Photo count summary */}
              <p className="text-center text-stone-500 text-sm mt-4">
                {photos.length} photos across {activeCategories.length} categories
              </p>
            </motion.div>
          )}

          {/* Category Detail View */}
          {view === 'category' && selectedCategory && (
            <CategoryGallery
              key="category"
              category={selectedCategory}
              photos={photosByCategory[selectedCategory.id]}
              onBack={() => setView('main')}
              onPhotoClick={(photo, index) => 
                handlePhotoClick(photo, index, photosByCategory[selectedCategory.id])
              }
            />
          )}
        </AnimatePresence>

        {/* Footer Actions */}
        <div className="flex gap-3 mt-5 pt-4 border-t border-stone-200">
          <Button
            onClick={onCancel}
            variant="outline"
            className="flex-1 rounded-full"
          >
            Back to Chat
          </Button>
          <Button
            onClick={onScheduleTour}
            className="flex-1 rounded-full bg-black hover:bg-stone-800"
          >
            Schedule a Tour
          </Button>
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxPhoto && (
          <Lightbox
            photo={lightboxPhoto}
            onClose={() => setLightboxPhoto(null)}
            onPrev={handleLightboxPrev}
            onNext={handleLightboxNext}
            hasPrev={lightboxIndex > 0}
            hasNext={lightboxIndex < currentPhotoSet.length - 1}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}