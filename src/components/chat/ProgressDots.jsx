import React from 'react';

export default function ProgressDots({ current, total }) {
  return (
    <div className="flex items-center justify-center gap-2 py-3">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full transition-all ${
            i === current ? 'bg-black w-6' : i < current ? 'bg-stone-400' : 'bg-stone-200'
          }`}
        />
      ))}
    </div>
  );
}