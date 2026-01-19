import React from 'react';

const actions = [
  { id: 'budget', label: '💰 Budget' },
  { id: 'gallery', label: '📸 Explore' },
  { id: 'visualizer', label: '✨ Preview' },
  { id: 'packages', label: '📦 Packages' },
  { id: 'availability', label: '📅 Availability' },
  { id: 'tour', label: '⛪️ Tour' },
];

export default function QuickActions({ onAction, disabled }) {
  return (
    <div className="px-4 py-3 border-t border-stone-200">
      <div className="flex flex-wrap gap-2">
        {actions.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => onAction(id)}
            disabled={disabled}
            className="px-3 py-2 bg-stone-100 hover:bg-stone-200 rounded-full text-sm text-stone-700 
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}