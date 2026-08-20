import React from 'react';
import { Building2 } from 'lucide-react';

export default function VenuePickerScreen({ venues, onSelect }) {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-stone-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-5 h-5 text-stone-500" />
          <h2 className="text-lg font-semibold">Select a venue to preview</h2>
        </div>
        <p className="text-sm text-stone-500 mb-4">
          Choose whose virtual planner you want to chat with.
        </p>
        <div className="space-y-2">
          {venues.map(v => (
            <button
              key={v.id}
              onClick={() => onSelect(v)}
              className="w-full text-left border border-stone-200 rounded-lg px-4 py-3 hover:border-black hover:bg-stone-50 transition-colors"
            >
              <p className="font-medium">{v.name}</p>
              <p className="text-xs text-stone-500">
                Planner: {v.planner_name || 'not set'}
                {v.slug ? ` · ?venue=${v.slug}` : ' · no slug set'}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}