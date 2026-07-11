import React from 'react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

const PRESETS = [
  { key: '7', label: 'Last 7 days' },
  { key: '30', label: 'Last 30 days' },
  { key: '90', label: 'Last 90 days' },
  { key: 'month', label: 'This month' },
  { key: 'custom', label: 'Custom' },
];

function toInput(d) {
  return format(d, 'yyyy-MM-dd');
}

export function computePresetRange(preset) {
  const now = new Date();
  if (preset === '7') return { start: toInput(subDays(now, 6)), end: toInput(now) };
  if (preset === '30') return { start: toInput(subDays(now, 29)), end: toInput(now) };
  if (preset === '90') return { start: toInput(subDays(now, 89)), end: toInput(now) };
  if (preset === 'month') return { start: toInput(startOfMonth(now)), end: toInput(endOfMonth(now)) };
  return null;
}

export default function DateRangeFilter({ preset, range, onChange }) {
  const handlePreset = (key) => {
    if (key === 'custom') {
      onChange({ preset: 'custom', range: range || computePresetRange('30') });
      return;
    }
    onChange({ preset: key, range: computePresetRange(key) });
  };

  const handleRangeField = (field, value) => {
    onChange({ preset: 'custom', range: { ...range, [field]: value } });
  };

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium text-stone-700">Date range:</span>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(p => (
          <button
            key={p.key}
            type="button"
            onClick={() => handlePreset(p.key)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              preset === p.key
                ? 'bg-stone-900 text-white border-stone-900'
                : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="flex items-center gap-2 ml-auto">
          <input
            type="date"
            value={range?.start || ''}
            onChange={(e) => handleRangeField('start', e.target.value)}
            className="px-2 py-1 border border-stone-200 rounded text-sm outline-none focus:border-stone-400"
          />
          <span className="text-stone-500 text-sm">to</span>
          <input
            type="date"
            value={range?.end || ''}
            onChange={(e) => handleRangeField('end', e.target.value)}
            className="px-2 py-1 border border-stone-200 rounded text-sm outline-none focus:border-stone-400"
          />
        </div>
      )}
    </div>
  );
}