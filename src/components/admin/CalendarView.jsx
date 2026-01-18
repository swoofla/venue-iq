import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameMonth, isSameDay } from 'date-fns';

export default function CalendarView({ weddings, blocked, onDateClick, onDeleteWedding }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const firstDayOfWeek = monthStart.getDay();
  const emptyDays = Array(firstDayOfWeek).fill(null);

  const getDateStatus = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const wedding = weddings.find(w => w.date === dateStr);
    const block = blocked.find(b => b.date === dateStr);
    
    if (wedding) return { type: 'wedding', data: wedding };
    if (block) return { type: 'blocked', data: block };
    return { type: 'available', data: null };
  };

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="outline"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </Button>
        <h2 className="text-xl font-semibold">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <Button
          variant="outline"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="gap-2"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-sm font-medium text-stone-600 py-2">
            {day}
          </div>
        ))}

        {emptyDays.map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}

        {daysInMonth.map(date => {
          const status = getDateStatus(date);
          const dateStr = format(date, 'yyyy-MM-dd');
          const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

          return (
            <button
              key={dateStr}
              onClick={() => !isPast && onDateClick(dateStr)}
              disabled={isPast}
              className={`
                aspect-square p-2 rounded-lg border transition-all text-sm
                ${isPast ? 'bg-stone-50 text-stone-300 cursor-not-allowed' : 'hover:border-stone-400 cursor-pointer'}
                ${status.type === 'wedding' ? 'bg-rose-100 border-rose-300' : ''}
                ${status.type === 'blocked' ? 'bg-stone-200 border-stone-400' : ''}
                ${status.type === 'available' && !isPast ? 'bg-white border-stone-200' : ''}
              `}
            >
              <div className="font-medium">{format(date, 'd')}</div>
              {status.type === 'wedding' && (
                <div className="text-xs text-rose-700 truncate mt-1">
                  {status.data.couple_name || 'Wedding'}
                </div>
              )}
              {status.type === 'blocked' && (
                <div className="text-xs text-stone-600 truncate mt-1">
                  Blocked
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex gap-4 mt-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-rose-100 border border-rose-300 rounded" />
          <span>Wedding Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-stone-200 border border-stone-400 rounded" />
          <span>Date Blocked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-white border border-stone-200 rounded" />
          <span>Available</span>
        </div>
      </div>
    </div>
  );
}