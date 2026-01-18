import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';

const LABELS = {
  guestTier: 'Package',
  dayOfWeek: 'Day of Week',
  season: 'Season',
  spirits: 'Spirits & Beverages',
  planning: 'Planning Services',
  catering: 'Catering',
  photography: 'Photography',
  florals: 'Florals',
  decor: 'Decorations',
  entertainment: 'Entertainment',
  videography: 'Videography',
  desserts: 'Desserts',
  linens: 'Table Linens',
  tableware: 'Tableware',
  extras: 'Extras Budget'
};

export default function BudgetSummaryBreakdown({ selections, totalBudget, onEditCategory }) {
  const items = Object.entries(selections)
    .filter(([key, value]) => value !== null && value !== undefined && value !== 0 && key !== 'totalBudget' && key !== 'guestCount')
    .map(([key, value]) => ({
      key,
      label: LABELS[key] || key,
      value
    }));

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => onEditCategory(item.key)}
          className="w-full flex items-center justify-between p-4 bg-stone-50 hover:bg-stone-100 rounded-lg transition-colors text-left group"
        >
          <div>
            <p className="text-sm text-stone-600">{item.label}</p>
            <p className="font-medium text-stone-900">{item.value}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-600 transition-colors" />
        </button>
      ))}
      
      <div className="border-t border-stone-200 pt-4 mt-4">
        <p className="text-sm text-stone-600 mb-2">Total Estimate</p>
        <p className="text-3xl font-bold text-stone-900">
          ${totalBudget.toLocaleString()}
        </p>
      </div>
    </div>
  );
}