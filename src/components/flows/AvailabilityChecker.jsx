import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';

export default function AvailabilityChecker({ venueId, onScheduleTour, onCancel }) {
  const [selectedDate, setSelectedDate] = useState('');
  const [checkResult, setCheckResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const checkAvailability = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!venueId) throw new Error('Please open the calendar for a specific venue.');
      const response = await base44.functions.invoke('checkDateAvailability', { venueId, date: selectedDate, alternativesCount: 2 });
      if (typeof response.data?.isAvailable !== 'boolean') throw new Error('Could not confirm availability. Please try again.');
      setCheckResult({ available: response.data.isAvailable, date: selectedDate, alternatives: response.data.alternatives || [] });
    } catch (err) {
      setError(err.message || 'Could not check availability. Please try again.');
    } finally { setLoading(false); }
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

      {error && <p role="alert" className="text-red-600 mb-4">{error}</p>}
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