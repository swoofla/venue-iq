import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, CheckCircle, XCircle } from 'lucide-react';
import { format, addDays, addWeeks } from 'date-fns';
import { base44 } from '@/api/base44Client';

export default function AvailabilityChecker({ bookedDates = [], onScheduleTour, onCancel }) {
  const [selectedDate, setSelectedDate] = useState('');
  const [checkResult, setCheckResult] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWeddingDates() {
      try {
        const result = await base44.functions.invoke('getHighLevelWeddingDates', {
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        });
        setAvailableDates(result.availableDates || []);
      } catch (error) {
        console.log('Using fallback - enable backend functions for HighLevel integration');
        setAvailableDates([]);
      } finally {
        setLoading(false);
      }
    }
    fetchWeddingDates();
  }, [bookedDates]);

  const checkAvailability = () => {
    // Parse date in UTC to avoid timezone shifting
    const dateObj = new Date(selectedDate + 'T00:00:00');
    const isAvailable = availableDates.includes(selectedDate);
    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 5 || dateObj.getDay() === 6; // Sun, Fri, Sat
    
    if (!isAvailable) {
      // Find nearest available dates
      let alternatives = [];
      
      if (isWeekend) {
        // For weekend dates, prioritize weekend alternatives
        for (let offset of [7, -7, 14, -14, 21, -21]) {
          const altDate = format(addDays(dateObj, offset), 'yyyy-MM-dd');
          const altDateObj = new Date(altDate);
          const isAltWeekend = altDateObj.getDay() === 0 || altDateObj.getDay() === 5 || altDateObj.getDay() === 6;
          
          if (isAltWeekend && availableDates.includes(altDate) && !alternatives.includes(altDate)) {
            alternatives.push(altDate);
            if (alternatives.length >= 2) break;
          }
        }
      } else {
        // For weekday dates, include any nearby available dates
        for (let offset of [1, -1, 2, -2, 3, -3, 7, -7]) {
          const altDate = format(addDays(dateObj, offset), 'yyyy-MM-dd');
          if (availableDates.includes(altDate) && !alternatives.includes(altDate)) {
            alternatives.push(altDate);
            if (alternatives.length >= 2) break;
          }
        }
      }
      
      setCheckResult({ available: false, alternatives: alternatives.slice(0, 2) });
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

      {loading ? (
        <div className="text-center py-8 text-stone-500">Loading availability...</div>
      ) : !checkResult ? (
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
            {format(new Date(checkResult.date + 'T00:00:00'), 'MMMM d, yyyy')} is available!
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
            Unfortunately there is a wedding already booked on {format(new Date(selectedDate + 'T00:00:00'), 'MMMM d, yyyy')}, however it looks like these dates around it are available:
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
                {format(new Date(date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
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