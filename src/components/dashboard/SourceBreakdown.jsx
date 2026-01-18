import React from 'react';
import { Calculator, Calendar, CheckSquare, MessageSquare } from 'lucide-react';

export default function SourceBreakdown({ submissions }) {
  const sourceCounts = {};
  submissions.forEach(s => {
    if (s.source) {
      sourceCounts[s.source] = (sourceCounts[s.source] || 0) + 1;
    }
  });

  const total = submissions.length;

  const sourceInfo = {
    'budget_calculator': {
      label: 'Budget Calculator',
      icon: Calculator,
      color: 'bg-blue-100 text-blue-700'
    },
    'tour_scheduler': {
      label: 'Tour Scheduler',
      icon: Calendar,
      color: 'bg-green-100 text-green-700'
    },
    'availability_check': {
      label: 'Date Checker',
      icon: CheckSquare,
      color: 'bg-purple-100 text-purple-700'
    },
    'chat': {
      label: 'Chat Inquiry',
      icon: MessageSquare,
      color: 'bg-orange-100 text-orange-700'
    }
  };

  const sources = Object.entries(sourceCounts).map(([source, count]) => ({
    source,
    count,
    percentage: Math.round((count / total) * 100),
    ...sourceInfo[source]
  }));

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-6">
      <h3 className="text-lg font-semibold mb-4">Lead Sources</h3>
      <div className="space-y-3">
        {sources.map(({ source, label, count, percentage, icon: Icon, color }) => (
          <div key={source}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {Icon && (
                  <div className={`p-1.5 rounded ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                )}
                <span className="text-sm font-medium text-stone-700">{label}</span>
              </div>
              <span className="text-sm text-stone-600">{count} ({percentage}%)</span>
            </div>
            <div className="w-full bg-stone-100 rounded-full h-2">
              <div
                className="bg-stone-700 h-2 rounded-full transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}