import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ImageCarouselMessage({ images = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef(null);
  const touchEndX = useRef(null);

  // Minimum swipe distance to trigger navigation (in pixels)
  const minSwipeDistance = 50;

  const displayImages = images.length > 0 ? images : [
    { url: '/placeholder-venue-1.jpg', caption: 'Welcome to our venue' }
  ];

  const next = () => setCurrentIndex((i) => (i + 1) % displayImages.length);
  const prev = () => setCurrentIndex((i) => (i - 1 + displayImages.length) % displayImages.length);

  // Touch handlers for swipe
  const onTouchStart = (e) => {
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      next(); // Swipe left = go to next image
    } else if (isRightSwipe) {
      prev(); // Swipe right = go to previous image
    }

    // Reset
    touchStartX.current = null;
    touchEndX.current = null;
  };

  if (displayImages.length === 0) return null;

  return (
    <div className="flex justify-start mb-4">
      <div className="flex gap-3 max-w-[90%]">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0 text-sm font-medium text-stone-600">
          E
        </div>
        
        {/* Carousel container */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-100">
          {/* Image area - Mobile-first: 300x400 portrait */}
          <div 
            className="relative bg-stone-100 select-none"
            style={{ width: '300px', height: '400px' }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <img
              src={displayImages[currentIndex].url}
              alt={displayImages[currentIndex].caption || 'Venue photo'}
              className="w-full h-full object-cover pointer-events-none"
              draggable={false}
            />
            
            {/* Navigation arrows - smaller and more subtle for mobile */}
            {displayImages.length > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/70 rounded-full 
                             flex items-center justify-center hover:bg-white/90 transition-colors shadow-sm
                             active:scale-95"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-4 h-4 text-stone-700" />
                </button>
                <button
                  onClick={next}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/70 rounded-full 
                             flex items-center justify-center hover:bg-white/90 transition-colors shadow-sm
                             active:scale-95"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-4 h-4 text-stone-700" />
                </button>
              </>
            )}
            
            {/* Caption overlay */}
            {displayImages[currentIndex].caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                <p className="text-white text-sm font-medium">
                  {displayImages[currentIndex].caption}
                </p>
              </div>
            )}
          </div>
          
          {/* Dot indicators */}
          {displayImages.length > 1 && (
            <div className="flex justify-center gap-2 py-3 bg-white">
              {displayImages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentIndex 
                      ? 'bg-stone-700 w-4' 
                      : 'bg-stone-300'
                  }`}
                  aria-label={`Go to image ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}