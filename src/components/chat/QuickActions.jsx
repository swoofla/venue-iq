import React from 'react';
import { Calculator, Calendar, CalendarCheck, Package } from 'lucide-react';

const actions = [
  { id: 'budget', label: 'Budget Calculator', icon: Calculator },
  { id: 'availability', label: 'Check Availability', icon: Calendar },
  { id: 'tour', label: 'Schedule a Tour', icon: CalendarCheck },
  { id: 'packages', label: 'View Packages', icon: Package },
];

export default function QuickActions({ onAction, disabled }) {
  return (
    <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-stone-100">
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={() => onAction(action.id)}
          disabled={disabled}
          className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <action.icon className="w-3.5 h-3.5" />
          {action.label}
        </button>
      ))}
    </div>
  );
}