import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ImageCarouselMessage({ images = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Default images if none provided (fallback)
  const displayImages = images.length > 0 ? images : [
    { url: '/placeholder-venue-1.jpg', caption: 'Welcome to our venue' }
  ];

  const next = () => setCurrentIndex((i) => (i + 1) % displayImages.length);
  const prev = () => setCurrentIndex((i) => (i - 1 + displayImages.length) % displayImages.length);

  if (displayImages.length === 0) return null;

  return (
    <div className="flex justify-start mb-4">
      <div className="flex gap-3 max-w-[85%]">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0 text-sm font-medium text-stone-600">
          E
        </div>
        
        {/* Carousel container */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-100">
          {/* Image area */}
          <div className="relative w-80 h-48 bg-stone-100">
            <img
              src={displayImages[currentIndex].url}
              alt={displayImages[currentIndex].caption || 'Venue photo'}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback if image fails to load
                e.target.style.display = 'none';
                e.target.parentElement.classList.add('flex', 'items-center', 'justify-center');
                e.target.parentElement.innerHTML = '<span class="text-stone-400 text-sm">Image unavailable</span>';
              }}
            />
            
            {/* Navigation arrows - only show if multiple images */}
            {displayImages.length > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-sm"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-5 h-5 text-stone-700" />
                </button>
                <button
                  onClick={next}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-sm"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-5 h-5 text-stone-700" />
                </button>
              </>
            )}
            
            {/* Caption overlay */}
            {displayImages[currentIndex].caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                <p className="text-white text-sm font-medium">
                  {displayImages[currentIndex].caption}
                </p>
              </div>
            )}
          </div>
          
          {/* Dot indicators - only show if multiple images */}
          {displayImages.length > 1 && (
            <div className="flex justify-center gap-1.5 py-2 bg-white">
              {displayImages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === currentIndex ? 'bg-stone-700' : 'bg-stone-300'
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