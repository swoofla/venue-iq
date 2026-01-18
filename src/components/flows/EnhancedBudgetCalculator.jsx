import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import ProgressDots from '../chat/ProgressDots';
import { DollarSign, CheckCircle } from 'lucide-react';

const GUEST_TIERS = {
  'up_to_2': '2 guests',
  '2_to_20': '2-20 guests',
  '20_to_50': '20-50 guests',
  '51_to_120': '51-120 guests',
};

const DAYS_OF_WEEK = {
  'saturday': 'Saturday',
  'friday': 'Friday',
  'sunday': 'Sunday',
  'weekday': 'Weekday',
};

const PEAK_SEASONS = {
  'peak': 'Peak Season',
  'non_peak': 'Non-Peak Season',
};

export default function EnhancedBudgetCalculator({ venueId, onComplete, onCancel }) {
  const [step, setStep] = useState(0);
  const [pricingConfig, setPricingConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selections, setSelections] = useState({
    guestTier: null,
    dayOfWeek: null,
    peakSeason: null,
    spirits: null,
    catering: null,
    planning: null,
    photography: null,
    florals: null,
    decor: null,
    entertainment: null,
    videography: null,
    desserts: null,
    linens: null,
    tableware: null,
    extras: 0,
  });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function fetchPricing() {
      try {
        const configs = await base44.entities.WeddingPricingConfiguration.filter({ venue_id: venueId });
        if (configs.length > 0) {
          setPricingConfig(configs[0].pricing_data);
        }
      } catch (error) {
        console.error('Failed to load pricing:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchPricing();
  }, [venueId]);

  const getOptionsForCategory = (category) => {
    if (!pricingConfig?.[category]) return [];
    const categoryData = pricingConfig[category];
    if (Array.isArray(categoryData)) {
      const tierData = categoryData.find(t => t.guest_tier === selections.guestTier);
      return tierData?.options || [];
    }
    return [];
  };

  const calculateTotal = () => {
    if (!pricingConfig || !selections.guestTier) return 0;
    let total = 0;

    // Base venue price
    const guestCount = parseInt(selections.guestTier.split('_')[1]) || 2;
    const basePriceObj = pricingConfig.venue_base?.[selections.guestTier];
    if (basePriceObj && selections.dayOfWeek) {
      const key = `${selections.dayOfWeek}_${selections.peakSeason || 'peak'}`;
      const price = basePriceObj[key]?.price || 0;
      total += price;
    }

    // Per-person multiplied services (spirits, catering)
    const spiritsOption = getOptionsForCategory('spirits').find(o => o.label === selections.spirits);
    if (spiritsOption?.price_type === 'per_person') {
      total += (spiritsOption.price * guestCount);
    } else if (spiritsOption?.price) {
      total += spiritsOption.price;
    }

    const cateringOption = getOptionsForCategory('catering').find(o => o.label === selections.catering);
    if (cateringOption?.price_type === 'per_person') {
      total += (cateringOption.price * guestCount);
    } else if (cateringOption?.price) {
      total += cateringOption.price;
    }

    // Flat-price services
    ['planning', 'photography', 'florals', 'decor', 'entertainment', 'videography', 'desserts', 'linens', 'tableware'].forEach(category => {
      const option = getOptionsForCategory(category).find(o => o.label === selections[category]);
      if (option?.price) {
        total += option.price;
      }
    });

    // Extras
    total += selections.extras;

    return total;
  };

  const steps = [
    {
      title: 'Guest Count',
      question: 'How many guests do you plan to have at your event?',
      key: 'guestTier',
      options: Object.entries(GUEST_TIERS).map(([key, label]) => ({ key, label })),
    },
    {
      title: 'Day of Week',
      question: 'What day of the week do you plan to get married on?',
      key: 'dayOfWeek',
      options: Object.entries(DAYS_OF_WEEK).map(([key, label]) => ({ key, label })),
    },
    {
      title: 'Peak Season',
      question: 'Will your wedding be during peak or non-peak season?',
      key: 'peakSeason',
      options: Object.entries(PEAK_SEASONS).map(([key, label]) => ({ key, label })),
    },
    {
      title: 'Spirits & Beverages',
      question: 'What kind of spirits do you plan to have?',
      key: 'spirits',
      options: getOptionsForCategory('spirits'),
    },
    {
      title: 'Catering',
      question: 'What kind of catering do you plan to have?',
      key: 'catering',
      options: getOptionsForCategory('catering'),
    },
    {
      title: 'Planning Services',
      question: 'Do you want planning and coordination services?',
      key: 'planning',
      options: getOptionsForCategory('planning'),
    },
    {
      title: 'Photography',
      question: 'What are you looking for in a photographer?',
      key: 'photography',
      options: getOptionsForCategory('photography'),
    },
    {
      title: 'Florals',
      question: 'What is your floral vision?',
      key: 'florals',
      options: getOptionsForCategory('florals'),
    },
    {
      title: 'Decorations',
      question: 'What are your plans for decorations and signage?',
      key: 'decor',
      options: getOptionsForCategory('decor'),
    },
    {
      title: 'Entertainment',
      question: 'What kind of entertainment are you looking for?',
      key: 'entertainment',
      options: getOptionsForCategory('entertainment'),
    },
    {
      title: 'Videography',
      question: 'Do you want a videographer?',
      key: 'videography',
      options: getOptionsForCategory('videography'),
    },
    {
      title: 'Desserts',
      question: 'What kind of desserts are you wanting?',
      key: 'desserts',
      options: getOptionsForCategory('desserts'),
    },
    {
      title: 'Table Linens',
      question: 'Do you want table linens?',
      key: 'linens',
      options: getOptionsForCategory('linens'),
    },
    {
      title: 'Tableware',
      question: 'What kind of tableware do you want?',
      key: 'tableware',
      options: getOptionsForCategory('tableware'),
    },
    {
      title: 'Extras Budget',
      question: 'How much do you want to allow for the "extras" (photo booth, live strings, favors, etc.)?',
      key: 'extras',
      options: [0, 500, 1000, 1500, 2000, 3000, 5000, 10000].map(amount => ({ key: amount, label: `$${amount}` })),
    },
  ];

  const currentStep = steps[step];
  const canContinue = selections[currentStep.key] !== null && selections[currentStep.key] !== undefined && selections[currentStep.key] !== '';
  const totalBudget = calculateTotal();

  const handleSelect = (value) => {
    setSelections(prev => ({
      ...prev,
      [currentStep.key]: value,
    }));
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      setSubmitted(true);
      onComplete({
        ...selections,
        totalBudget,
        guestCount: selections.guestTier,
      });
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading budget calculator...</div>;
  }

  if (!pricingConfig) {
    return <div className="text-center py-8 text-red-600">Pricing configuration not found. Please contact support.</div>;
  }

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
        <h3 className="text-xl font-semibold text-stone-900 mb-2">Your Budget Estimate</h3>
        
        <div className="bg-stone-50 rounded-xl p-6 mb-4 text-left">
          <div className="text-4xl font-bold text-stone-900 mb-4 text-center">
            ${totalBudget.toLocaleString()}
          </div>
          <div className="space-y-2 text-sm">
            <p><span className="font-semibold">Guests:</span> {GUEST_TIERS[selections.guestTier]}</p>
            <p><span className="font-semibold">Day:</span> {selections.dayOfWeek}</p>
            <p><span className="font-semibold">Season:</span> {PEAK_SEASONS[selections.peakSeason]}</p>
          </div>
        </div>

        <p className="text-sm text-stone-600 mb-4">
          Would you like to schedule a tour to see our venue and discuss your wedding vision in person?
        </p>

        <Button onClick={onCancel} className="w-full rounded-full bg-black hover:bg-stone-800">
          Schedule a Tour
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
      <ProgressDots current={step} total={steps.length} />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="mt-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-stone-400" />
            <h3 className="text-lg font-semibold text-stone-900">{currentStep.title}</h3>
          </div>
          <p className="text-stone-600 mb-4">{currentStep.question}</p>

          <div className="space-y-2">
            {currentStep.options.map((option) => {
              const optionKey = option.key || option.label;
              const isSelected = selections[currentStep.key] === optionKey;
              const displayLabel = option.label || optionKey;
              const displayPrice = option.price !== undefined ? ` - $${option.price}` : '';

              return (
                <button
                  key={optionKey}
                  onClick={() => handleSelect(optionKey)}
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-black text-white'
                      : 'bg-stone-50 hover:bg-stone-100 text-stone-700'
                  }`}
                >
                  <p className="font-medium">{displayLabel}{displayPrice}</p>
                </button>
              );
            })}
          </div>

          {/* Budget preview */}
          {totalBudget > 0 && (
            <div className="mt-6 p-4 bg-stone-50 rounded-lg">
              <p className="text-sm text-stone-600">Estimated Total so far:</p>
              <p className="text-2xl font-bold text-stone-900">${totalBudget.toLocaleString()}</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex gap-2 mt-6">
        <Button
          onClick={() => step === 0 ? onCancel() : setStep(step - 1)}
          variant="outline"
          className="flex-1 rounded-full"
        >
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        <Button
          onClick={handleNext}
          disabled={!canContinue}
          className="flex-1 rounded-full bg-black hover:bg-stone-800"
        >
          {step === steps.length - 1 ? 'See Total' : 'Continue'}
        </Button>
      </div>
    </motion.div>
  );
}