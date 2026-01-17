import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ProgressDots from '../chat/ProgressDots';
import { DollarSign, Users, Heart, Check } from 'lucide-react';

const priorities = [
  'Photography', 'Catering', 'Flowers', 'Music/DJ', 'Dress', 'Decor'
];

const packages = [
  { id: 'intimate_garden', name: 'Intimate Garden', price: 8500, maxGuests: 50 },
  { id: 'classic_elegance', name: 'Classic Elegance', price: 15000, maxGuests: 120 },
  { id: 'grand_estate', name: 'Grand Estate', price: 25000, maxGuests: 250 },
];

export default function BudgetCalculator({ onComplete, onCancel }) {
  const [step, setStep] = useState(0);
  const [budget, setBudget] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [selectedPriorities, setSelectedPriorities] = useState([]);
  const [showResults, setShowResults] = useState(false);

  const togglePriority = (priority) => {
    if (selectedPriorities.includes(priority)) {
      setSelectedPriorities(selectedPriorities.filter(p => p !== priority));
    } else if (selectedPriorities.length < 3) {
      setSelectedPriorities([...selectedPriorities, priority]);
    }
  };

  const calculateResults = () => {
    const venueAllocation = parseFloat(budget) * 0.45;
    const guests = parseInt(guestCount);
    
    let recommended = packages[0];
    for (const pkg of packages) {
      if (pkg.price <= venueAllocation && pkg.maxGuests >= guests) {
        recommended = pkg;
      }
    }
    
    const remaining = parseFloat(budget) - recommended.price;
    const perPriority = remaining / selectedPriorities.length;
    
    return {
      recommended,
      venueAllocation,
      remaining,
      breakdown: selectedPriorities.map(p => ({ name: p, amount: perPriority }))
    };
  };

  const handleNext = () => {
    if (step === 0 && budget) {
      setStep(1);
    } else if (step === 1 && guestCount) {
      setStep(2);
    } else if (step === 2 && selectedPriorities.length === 3) {
      setShowResults(true);
    }
  };

  const handleComplete = () => {
    const results = calculateResults();
    onComplete({
      budget: parseFloat(budget),
      guestCount: parseInt(guestCount),
      priorities: selectedPriorities,
      recommendedPackage: results.recommended.name
    });
  };

  if (showResults) {
    const results = calculateResults();
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 mb-4"
      >
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Your Personalized Recommendation</h3>
        
        <div className="bg-stone-50 rounded-xl p-4 mb-4">
          <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">Recommended Package</p>
          <p className="text-xl font-bold text-stone-900">{results.recommended.name}</p>
          <p className="text-2xl font-bold text-black mt-1">${results.recommended.price.toLocaleString()}</p>
          <p className="text-sm text-stone-600 mt-1">Up to {results.recommended.maxGuests} guests</p>
        </div>

        <div className="mb-4">
          <p className="text-sm font-medium text-stone-700 mb-2">Suggested Budget Breakdown</p>
          <div className="space-y-2">
            {results.breakdown.map((item) => (
              <div key={item.name} className="flex justify-between items-center py-2 border-b border-stone-100">
                <span className="text-sm text-stone-600">{item.name}</span>
                <span className="text-sm font-medium text-stone-900">${Math.round(item.amount).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-stone-500 mb-4">
          Based on allocating 45% of your budget to the venue, you have ${Math.round(results.remaining).toLocaleString()} remaining for other priorities.
        </p>

        <div className="flex gap-2">
          <Button onClick={onCancel} variant="outline" className="flex-1 rounded-full">
            Back to Chat
          </Button>
          <Button onClick={handleComplete} className="flex-1 rounded-full bg-black hover:bg-stone-800">
            Schedule a Tour
          </Button>
        </div>
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
              <DollarSign className="w-5 h-5 text-stone-400" />
              <h3 className="text-lg font-semibold text-stone-900">What's your total wedding budget?</h3>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500">$</span>
              <Input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="50,000"
                className="pl-8 h-12 rounded-xl text-lg"
              />
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
              <Users className="w-5 h-5 text-stone-400" />
              <h3 className="text-lg font-semibold text-stone-900">Expected guest count?</h3>
            </div>
            <Input
              type="number"
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              placeholder="100"
              className="h-12 rounded-xl text-lg"
            />
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
              <Heart className="w-5 h-5 text-stone-400" />
              <h3 className="text-lg font-semibold text-stone-900">Select your top 3 priorities</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {priorities.map((priority) => (
                <button
                  key={priority}
                  onClick={() => togglePriority(priority)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-between ${
                    selectedPriorities.includes(priority)
                      ? 'bg-black text-white'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {priority}
                  {selectedPriorities.includes(priority) && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
            <p className="text-xs text-stone-500 mt-2 text-center">
              {selectedPriorities.length}/3 selected
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2 mt-4">
        <Button onClick={onCancel} variant="outline" className="flex-1 rounded-full">
          Cancel
        </Button>
        <Button
          onClick={handleNext}
          disabled={
            (step === 0 && !budget) ||
            (step === 1 && !guestCount) ||
            (step === 2 && selectedPriorities.length !== 3)
          }
          className="flex-1 rounded-full bg-black hover:bg-stone-800"
        >
          {step === 2 ? 'See Results' : 'Continue'}
        </Button>
      </div>
    </motion.div>
  );
}