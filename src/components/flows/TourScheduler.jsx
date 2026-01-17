import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ProgressDots from '../chat/ProgressDots';
import { CalendarCheck, Clock, User, CheckCircle } from 'lucide-react';
import { format, addDays, nextTuesday, nextThursday, nextSaturday, nextSunday } from 'date-fns';

const timeSlots = {
  Tuesday: ['10:00 AM', '2:00 PM', '4:00 PM'],
  Thursday: ['10:00 AM', '2:00 PM', '4:00 PM'],
  Saturday: ['9:00 AM', '11:00 AM', '1:00 PM', '3:00 PM'],
  Sunday: ['12:00 PM', '2:00 PM', '4:00 PM'],
};

const getUpcomingDates = () => {
  const today = new Date();
  return [
    { day: 'Tuesday', date: nextTuesday(today) },
    { day: 'Thursday', date: nextThursday(today) },
    { day: 'Saturday', date: nextSaturday(today) },
    { day: 'Sunday', date: nextSunday(today) },
  ].sort((a, b) => a.date - b.date);
};

export default function TourScheduler({ preSelectedDate, onComplete, onCancel }) {
  const [step, setStep] = useState(0);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    weddingDate: preSelectedDate || '',
    guestCount: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const upcomingDates = getUpcomingDates();

  const handleNext = () => {
    if (step === 0 && selectedDay) {
      setStep(1);
    } else if (step === 1 && selectedTime) {
      setStep(2);
    }
  };

  const handleSubmit = () => {
    setSubmitted(true);
    onComplete({
      ...formData,
      tourDate: format(selectedDay.date, 'yyyy-MM-dd'),
      tourTime: selectedTime,
    });
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 mb-4 text-center"
      >
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold text-stone-900 mb-2">Tour Scheduled!</h3>
        <p className="text-stone-600 mb-4">We're excited to show you Sugar Lake Weddings.</p>
        
        <div className="bg-stone-50 rounded-xl p-4 mb-4 text-left">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-stone-500">Date</p>
              <p className="font-medium text-stone-900">{format(selectedDay.date, 'EEEE, MMM d')}</p>
            </div>
            <div>
              <p className="text-stone-500">Time</p>
              <p className="font-medium text-stone-900">{selectedTime}</p>
            </div>
            <div>
              <p className="text-stone-500">Name</p>
              <p className="font-medium text-stone-900">{formData.name}</p>
            </div>
            <div>
              <p className="text-stone-500">Email</p>
              <p className="font-medium text-stone-900">{formData.email}</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-stone-500 mb-4">
          You'll receive a confirmation email shortly with all the details.
        </p>

        <Button onClick={onCancel} className="w-full rounded-full bg-black hover:bg-stone-800">
          Back to Chat
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 mb-4"
    >
      <ProgressDots current={step} total={3} />

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="step0"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="mt-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <CalendarCheck className="w-5 h-5 text-stone-400" />
              <h3 className="text-lg font-semibold text-stone-900">Select a Day</h3>
            </div>
            <div className="space-y-2">
              {upcomingDates.map((dateOption) => (
                <button
                  key={dateOption.day}
                  onClick={() => setSelectedDay(dateOption)}
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    selectedDay?.day === dateOption.day
                      ? 'bg-black text-white'
                      : 'bg-stone-50 hover:bg-stone-100 text-stone-700'
                  }`}
                >
                  <p className="font-medium">{dateOption.day}</p>
                  <p className={`text-sm ${selectedDay?.day === dateOption.day ? 'text-stone-300' : 'text-stone-500'}`}>
                    {format(dateOption.date, 'MMMM d, yyyy')}
                  </p>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="mt-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-stone-400" />
              <h3 className="text-lg font-semibold text-stone-900">Select a Time</h3>
            </div>
            <p className="text-sm text-stone-500 mb-3">
              {format(selectedDay.date, 'EEEE, MMMM d')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {timeSlots[selectedDay.day].map((time) => (
                <button
                  key={time}
                  onClick={() => setSelectedTime(time)}
                  className={`p-3 rounded-xl text-sm font-medium transition-all ${
                    selectedTime === time
                      ? 'bg-black text-white'
                      : 'bg-stone-50 hover:bg-stone-100 text-stone-700'
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="mt-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <User className="w-5 h-5 text-stone-400" />
              <h3 className="text-lg font-semibold text-stone-900">Your Details</h3>
            </div>
            <div className="space-y-3">
              <Input
                placeholder="Full Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-12 rounded-xl"
              />
              <Input
                type="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="h-12 rounded-xl"
              />
              <Input
                type="tel"
                placeholder="Phone Number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="h-12 rounded-xl"
              />
              <Input
                type="date"
                placeholder="Wedding Date"
                value={formData.weddingDate}
                onChange={(e) => setFormData({ ...formData, weddingDate: e.target.value })}
                className="h-12 rounded-xl"
              />
              <Input
                type="number"
                placeholder="Expected Guest Count"
                value={formData.guestCount}
                onChange={(e) => setFormData({ ...formData, guestCount: e.target.value })}
                className="h-12 rounded-xl"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2 mt-4">
        <Button
          onClick={() => step === 0 ? onCancel() : setStep(step - 1)}
          variant="outline"
          className="flex-1 rounded-full"
        >
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        <Button
          onClick={step === 2 ? handleSubmit : handleNext}
          disabled={
            (step === 0 && !selectedDay) ||
            (step === 1 && !selectedTime) ||
            (step === 2 && (!formData.name || !formData.email || !formData.phone))
          }
          className="flex-1 rounded-full bg-black hover:bg-stone-800"
        >
          {step === 2 ? 'Confirm Booking' : 'Continue'}
        </Button>
      </div>
    </motion.div>
  );
}