import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, CheckCircle, XCircle } from 'lucide-react';
import { format, addDays, addWeeks } from 'date-fns';

export default function AvailabilityChecker({ bookedDates = [], onScheduleTour, onCancel }) {
  const [selectedDate, setSelectedDate] = useState('');
  const [checkResult, setCheckResult] = useState(null);

  const checkAvailability = () => {
    const isBooked = bookedDates.some(d => d.date === selectedDate);
    
    if (isBooked) {
      const dateObj = new Date(selectedDate);
      const alternatives = [
        format(addDays(dateObj, 7), 'yyyy-MM-dd'),
        format(addDays(dateObj, 14), 'yyyy-MM-dd'),
        format(addWeeks(dateObj, -1), 'yyyy-MM-dd'),
      ].filter(d => !bookedDates.some(bd => bd.date === d));
      
      setCheckResult({ available: false, alternatives: alternatives.slice(0, 3) });
    } else {
      setCheckResult({ available: true, date: selectedDate });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 mb-4"
    >
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-stone-400" />
        <h3 className="text-lg font-semibold text-stone-900">Check Date Availability</h3>
      </div>

      {!checkResult ? (
        <>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            min={format(new Date(), 'yyyy-MM-dd')}
            className="h-12 rounded-xl mb-4"
          />
          <div className="flex gap-2">
            <Button onClick={onCancel} variant="outline" className="flex-1 rounded-full">
              Cancel
            </Button>
            <Button
              onClick={checkAvailability}
              disabled={!selectedDate}
              className="flex-1 rounded-full bg-black hover:bg-stone-800"
            >
              Check Availability
            </Button>
          </div>
        </>
      ) : checkResult.available ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h4 className="text-lg font-semibold text-stone-900 mb-2">Great News!</h4>
          <p className="text-stone-600 mb-4">
            {format(new Date(checkResult.date), 'MMMM d, yyyy')} is available!
          </p>
          <div className="flex gap-2">
            <Button onClick={onCancel} variant="outline" className="flex-1 rounded-full">
              Back to Chat
            </Button>
            <Button
              onClick={() => onScheduleTour(checkResult.date)}
              className="flex-1 rounded-full bg-black hover:bg-stone-800"
            >
              Schedule a Tour
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-stone-500" />
          </div>
          <h4 className="text-lg font-semibold text-stone-900 mb-2 text-center">Date Not Available</h4>
          <p className="text-stone-600 mb-4 text-center text-sm">
            Unfortunately, {format(new Date(selectedDate), 'MMMM d, yyyy')} is already booked. Here are some nearby alternatives:
          </p>
          <div className="space-y-2 mb-4">
            {checkResult.alternatives.map((date) => (
              <button
                key={date}
                onClick={() => {
                  setSelectedDate(date);
                  setCheckResult(null);
                }}
                className="w-full p-3 bg-stone-50 hover:bg-stone-100 rounded-xl text-sm font-medium text-stone-700 transition-colors text-left"
              >
                {format(new Date(date), 'EEEE, MMMM d, yyyy')}
              </button>
            ))}
          </div>
          <Button onClick={onCancel} variant="outline" className="w-full rounded-full">
            Back to Chat
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}