import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import ProgressDots from '../chat/ProgressDots';
import { DollarSign, CheckCircle, AlertCircle, Mail } from 'lucide-react';

// AVAILABILITY RULES - Controls which day/season combos are valid per tier
const AVAILABILITY_RULES = {
  up_to_2: {
    peak: ['weekday'],
    nonpeak: ['saturday', 'friday', 'sunday', 'weekday']
  },
  '2_to_20': {
    peak: ['weekday'],
    nonpeak: ['saturday', 'friday', 'sunday', 'weekday']
  },
  '20_to_50': {
    peak: ['sunday', 'weekday'],
    nonpeak: ['saturday', 'friday', 'sunday', 'weekday']
  },
  '51_to_120': {
    peak: ['saturday', 'friday', 'sunday', 'weekday'],
    nonpeak: ['saturday', 'friday', 'sunday', 'weekday']
  }
};

const TIER_RANGES = {
  up_to_2: { min: 1, max: 2, default: 2 },
  '2_to_20': { min: 3, max: 20, default: 12 },
  '20_to_50': { min: 21, max: 50, default: 35 },
  '51_to_120': { min: 51, max: 120, default: 85 }
};

const GUEST_TIERS = [
{ id: 'up_to_2', label: 'Just us two 💕', sublabel: 'Elopement Package' },
{ id: '2_to_20', label: 'Inner Circle', sublabel: 'Intimate gathering (2-20)' },
{ id: '20_to_50', label: '50 and Under', sublabel: 'Small celebration (21-50)' },
{ id: '51_to_120', label: 'Classic Wedding', sublabel: '51-120 guests' }];


const ALL_DAYS = [
{ id: 'saturday', label: 'Saturday' },
{ id: 'friday', label: 'Friday' },
{ id: 'sunday', label: 'Sunday' },
{ id: 'weekday', label: 'Weekday (Mon-Thu)' }];


const ALL_SEASONS = [
{ id: 'peak', label: 'Peak Season (May - October)' },
{ id: 'nonpeak', label: 'Non-Peak Season (November - April)' }];


// Helper function to safely parse JSON if it's a string
const safeJsonParse = (data) => {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to parse JSON string:', e);
      return null;
    }
  }
  return data;
};

// Helper function to get nested data from config
const getConfigField = (config, fieldName) => {
  if (!config) return null;

  // Try direct access first (root level)
  if (config[fieldName] !== undefined) {
    return safeJsonParse(config[fieldName]);
  }

  // Try inside pricing_data wrapper
  if (config.pricing_data) {
    const pricingData = safeJsonParse(config.pricing_data);
    if (pricingData && pricingData[fieldName] !== undefined) {
      return safeJsonParse(pricingData[fieldName]);
    }
  }

  // Try inside data wrapper
  if (config.data) {
    const data = safeJsonParse(config.data);
    if (data && data[fieldName] !== undefined) {
      return safeJsonParse(data[fieldName]);
    }
  }

  return null;
};

export default function EnhancedBudgetCalculator({ venueId, onComplete, onCancel }) {
  const [step, setStep] = useState(0);
  const [pricingConfig, setPricingConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selections, setSelections] = useState({
    guestTier: null,
    guestCount: null,
    dayOfWeek: null,
    season: null,
    spirits: null,
    planning: null,
    catering: null,
    photography: null,
    florals: null,
    decor: null,
    entertainment: null,
    videography: null,
    desserts: null,
    linens: null,
    tableware: null,
    extras: 0
  });
  const [submitted, setSubmitted] = useState(false);
  const [contactInfo, setContactInfo] = useState({
    name: '',
    email: '',
    phone: '',
    deliveryPreference: 'email'
  });
  const [saving, setSaving] = useState(false);
  const [showAllSelections, setShowAllSelections] = useState(false);

  useEffect(() => {
    async function fetchPricing() {
      try {
        const configs = await base44.entities.WeddingPricingConfiguration.filter({ venue_id: venueId });

        // DIAGNOSTIC: Log the raw response to see exact structure
        console.log('=== PRICING CONFIG DEBUG ===');
        console.log('Raw configs array:', configs);

        if (configs.length > 0) {
          const rawConfig = configs[0];
          console.log('Raw config object:', rawConfig);
          console.log('Config keys:', Object.keys(rawConfig));

          // Log each key and its type/value
          Object.keys(rawConfig).forEach((key) => {
            const value = rawConfig[key];
            console.log(`  ${key}: [${typeof value}]`,
            typeof value === 'string' && value.length > 100 ?
            value.substring(0, 100) + '...' :
            value
            );
          });

          // Check for venue_base in different locations
          console.log('Looking for venue_base...');
          console.log('  Direct (rawConfig.venue_base):', rawConfig.venue_base);
          console.log('  In pricing_data:', rawConfig.pricing_data?.venue_base);

          setPricingConfig(rawConfig);
        }
      } catch (error) {
        console.error('Failed to load pricing:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchPricing();
  }, [venueId]);

  // Get available days based on tier + season
  const getAvailableDays = () => {
    if (!selections.guestTier || !selections.season) return ALL_DAYS;
    const rules = AVAILABILITY_RULES[selections.guestTier];
    if (!rules) return ALL_DAYS;
    const allowedDays = rules[selections.season] || [];
    return ALL_DAYS.filter((day) => allowedDays.includes(day.id));
  };

  // Get available seasons based on tier
  const getAvailableSeasons = () => {
    if (!selections.guestTier) return ALL_SEASONS;
    return ALL_SEASONS;
  };

  // Get category options based on tier - UPDATED to use helper function
  const getOptionsForCategory = (category) => {
    if (!pricingConfig || !selections.guestTier) return [];

    const categoryData = getConfigField(pricingConfig, category);
    console.log(`Getting ${category} options:`, categoryData);

    if (!categoryData) {
      console.log(`  No data found for ${category}`);
      return [];
    }

    // Handle object structure keyed by tier ID
    if (categoryData[selections.guestTier]) {
      console.log(`  Found options for tier ${selections.guestTier}:`, categoryData[selections.guestTier]);
      return categoryData[selections.guestTier];
    }

    // Handle array structure with guest_tier field
    if (Array.isArray(categoryData)) {
      const tierData = categoryData.find((t) => t.guest_tier === selections.guestTier);
      console.log(`  Found array data for tier:`, tierData);
      return tierData?.options || [];
    }

    console.log(`  Could not find options for tier ${selections.guestTier}`);
    return [];
  };

  // Calculate running total - UPDATED to use helper function
  const calculateTotal = () => {
    if (!pricingConfig || !selections.guestTier) return 0;
    let total = 0;
    const guestCount = selections.guestCount || TIER_RANGES[selections.guestTier]?.default || 2;

    // Base venue price - use helper function
    const venueBase = getConfigField(pricingConfig, 'venue_base');

    console.log('=== CALCULATE TOTAL DEBUG ===');
    console.log('Venue base data:', venueBase);
    console.log('Selected tier:', selections.guestTier);
    console.log('Selected day:', selections.dayOfWeek);
    console.log('Selected season:', selections.season);

    if (venueBase && selections.guestTier && selections.dayOfWeek && selections.season) {
      const tierPricing = venueBase[selections.guestTier];
      console.log('Tier pricing object:', tierPricing);

      if (tierPricing) {
        const seasonKey = selections.season === 'peak' ? 'peak' : 'non_peak';
        const key = `${selections.dayOfWeek}_${seasonKey}`;
        console.log('Looking for price key:', key);

        const priceEntry = tierPricing[key];
        console.log('Found price entry:', priceEntry);

        if (priceEntry?.price) {
          total += priceEntry.price;
          console.log('Added base price:', priceEntry.price);
        } else if (typeof priceEntry === 'number') {
          // Handle case where price is stored directly as number
          total += priceEntry;
          console.log('Added base price (direct number):', priceEntry);
        }
      }
    }

    // Calculate each category
    const categories = ['spirits', 'planning', 'catering', 'photography', 'florals',
    'decor', 'entertainment', 'videography', 'desserts', 'linens', 'tableware'];

    categories.forEach((category) => {
      const options = getOptionsForCategory(category);
      const selected = options.find((o) => o.label === selections[category]);
      if (selected) {
        if (selected.price_type === 'per_person') {
          total += selected.price * guestCount;
        } else if (selected.price_type === 'flat_plus_per_person') {
          total += selected.price + (selected.extra_pp || 0) * guestCount;
        } else {
          total += selected.price || 0;
        }
      }
    });

    total += selections.extras || 0;
    console.log('TOTAL CALCULATED:', total);
    return total;
  };

  // Step definitions
  const getSteps = () => {
    const steps = [
    {
      title: 'Guest Count',
      question: 'How many guests do you plan to have at your event?',
      key: 'guestTier',
      type: 'guest_tier'
    },
    {
      title: 'Season',
      question: 'What time of year are you considering?',
      key: 'season',
      type: 'season',
      restriction: selections.guestTier && ['up_to_2', '2_to_20'].includes(selections.guestTier) ?
      '⚠️ Note: Peak season (May-Oct) is only available on weekdays for this package.' :
      selections.guestTier === '20_to_50' ?
      '⚠️ Note: Peak season (May-Oct) is only available Sunday or weekdays for this package.' :
      null
    },
    {
      title: 'Day of Week',
      question: 'What day of the week do you plan to get married on?',
      key: 'dayOfWeek',
      type: 'day_of_week'
    }];


    if (selections.guestTier) {
      const categorySteps = [
      { title: 'Spirits & Beverages', question: 'What kind of spirits do you plan to have?', key: 'spirits', type: 'category' },
      { title: 'Planning Services', question: 'Do you want planning and coordination services?', key: 'planning', type: 'category' },
      { title: 'Catering', question: 'What kind of catering do you plan to have?', key: 'catering', type: 'category' },
      { title: 'Photography', question: 'What are you looking for in a photographer?', key: 'photography', type: 'category' },
      { title: 'Florals', question: 'What is your floral vision?', key: 'florals', type: 'category' },
      { title: 'Decorations', question: 'What are your plans for decorations and signage?', key: 'decor', type: 'category' },
      { title: 'Entertainment', question: 'What kind of entertainment are you looking for?', key: 'entertainment', type: 'category' },
      { title: 'Videography', question: 'Do you want a videographer?', key: 'videography', type: 'category' },
      { title: 'Desserts', question: 'What kind of desserts are you wanting?', key: 'desserts', type: 'category' },
      { title: 'Table Linens', question: 'Do you want table linens?', key: 'linens', type: 'category' },
      { title: 'Tableware', question: 'What kind of tableware do you want?', key: 'tableware', type: 'category' },
      { title: 'Extras Budget', question: "How much do you want to allow for 'extras'?", key: 'extras', type: 'extras' }];

      return [...steps, ...categorySteps];
    }
    return steps;
  };

  const steps = getSteps();
  const currentStep = steps[step];

  const getCurrentOptions = () => {
    if (!currentStep) return [];
    switch (currentStep.type) {
      case 'guest_tier':
        return GUEST_TIERS;
      case 'season':
        return getAvailableSeasons();
      case 'day_of_week':
        return getAvailableDays();
      case 'category':
        return getOptionsForCategory(currentStep.key);
      case 'extras':
        return [
        { id: 0, label: '$0' },
        { id: 500, label: '$500' },
        { id: 1000, label: '$1,000' },
        { id: 1500, label: '$1,500' },
        { id: 2000, label: '$2,000' },
        { id: 3000, label: '$3,000' },
        { id: 5000, label: '$5,000' },
        { id: 10000, label: '$10,000' }];

      default:
        return [];
    }
  };

  const currentOptions = getCurrentOptions();
  const canContinue = currentStep?.type === 'guest_tier' 
    ? selections.guestTier !== null && (selections.guestTier === 'up_to_2' || selections.guestCount !== null)
    : currentStep?.type === 'extras'
    ? true // Extras always has a default value of 0
    : selections[currentStep?.key] !== null && selections[currentStep?.key] !== undefined;
  const totalBudget = calculateTotal();

  const handleGuestCountChange = (newCount) => {
    const tierRange = TIER_RANGES[selections.guestTier];
    if (tierRange) {
      const clampedCount = Math.max(tierRange.min, Math.min(tierRange.max, parseInt(newCount) || tierRange.default));
      setSelections(prev => ({ ...prev, guestCount: clampedCount }));
    }
  };

  const handleSelect = (value) => {
    const key = currentStep.key;

    if (key === 'guestTier' && value !== selections.guestTier) {
      setSelections((prev) => ({
        ...prev,
        guestTier: value,
        guestCount: TIER_RANGES[value]?.default || null,
        dayOfWeek: null,
        season: null,
        spirits: null,
        planning: null,
        catering: null,
        photography: null,
        florals: null,
        decor: null,
        entertainment: null,
        videography: null,
        desserts: null,
        linens: null,
        tableware: null
      }));
      return;
    }

    if (key === 'season') {
      const newSeason = value;
      const currentDay = selections.dayOfWeek;
      const tier = selections.guestTier;
      const rules = AVAILABILITY_RULES[tier];

      if (currentDay && rules) {
        const allowedDays = rules[newSeason] || [];
        if (!allowedDays.includes(currentDay)) {
          setSelections((prev) => ({
            ...prev,
            season: newSeason,
            dayOfWeek: null
          }));
          return;
        }
      }
    }

    setSelections((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      // Only show summary screen - onComplete is called from handleSaveAndSend
      setSubmitted(true);
    }
  };

  const handleBack = () => {
    if (step === 0) {
      onCancel();
    } else {
      setStep(step - 1);
    }
  };

  const formatPrice = (option) => {
    if (option.price === undefined || option.price === null) return '';
    if (option.price_type === 'per_person') {
      return ` - $${option.price}/person`;
    } else if (option.price_type === 'flat_plus_per_person') {
      return ` - $${option.price} + $${option.extra_pp}/person`;
    } else if (option.price > 0) {
      return ` - $${option.price.toLocaleString()}${option.note ? ` (${option.note})` : ''}`;
    }
    return '';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 mb-4">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
          <span className="ml-3 text-stone-600">Loading budget calculator...</span>
        </div>
      </div>);

  }

  if (!pricingConfig) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 mb-4">
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-stone-900 mb-2">Pricing Not Available</h3>
          <p className="text-stone-600 mb-4">Please contact us directly for a custom quote.</p>
          <Button onClick={onCancel} variant="outline" className="rounded-full">
            Back to Chat
          </Button>
        </div>
      </div>);

  }

  const handleSaveAndSend = async () => {
    // Validate based on delivery preference
    if (!contactInfo.name) {
      alert('Please enter your name');
      return;
    }
    
    if (contactInfo.deliveryPreference === 'email' && !contactInfo.email) {
      alert('Please enter your email address');
      return;
    }
    
    if (contactInfo.deliveryPreference === 'text' && !contactInfo.phone) {
      alert('Please enter your phone number');
      return;
    }

    setSaving(true);
    try {
      // Save to ContactSubmission
      await base44.entities.ContactSubmission.create({
        venue_id: venueId,
        name: contactInfo.name,
        email: contactInfo.email || null,
        phone: contactInfo.phone || null,
        guest_count: selections.guestCount,
        budget: totalBudget,
        source: 'budget_calculator',
        status: 'new',
        priorities: Object.entries(selections)
          .filter(([key, value]) => value && !['guestTier', 'guestCount', 'dayOfWeek', 'season', 'extras'].includes(key))
          .map(([key, value]) => `${key}: ${value}`)
          .slice(0, 3)
      });

      // Sync to HighLevel
      try {
        await base44.functions.invoke('createHighLevelContact', {
          name: contactInfo.name,
          email: contactInfo.email,
          phone: contactInfo.phone,
          guest_count: selections.guestCount,
          budget: totalBudget,
          source: 'budget_calculator'
        });
      } catch (hlError) {
        console.error('HighLevel sync error:', hlError);
      }

      // Complete the flow
      onComplete({
        name: contactInfo.name,
        email: contactInfo.email,
        phone: contactInfo.phone,
        guestTier: selections.guestTier,
        guestCount: selections.guestCount,
        dayOfWeek: selections.dayOfWeek,
        season: selections.season,
        totalBudget: totalBudget,
        selections: selections
      });
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = () => {
    setSubmitted(false);
    setStep(0);
  };

  const getItemizedBreakdown = () => {
    const guestCount = selections.guestCount || TIER_RANGES[selections.guestTier]?.default || 2;
    const venueBase = getConfigField(pricingConfig, 'venue_base');
    const items = [];

    // Base venue price
    if (venueBase && selections.guestTier && selections.dayOfWeek && selections.season) {
      const tierPricing = venueBase[selections.guestTier];
      if (tierPricing) {
        const seasonKey = selections.season === 'peak' ? 'peak' : 'non_peak';
        const key = `${selections.dayOfWeek}_${seasonKey}`;
        const priceEntry = tierPricing[key];
        const basePrice = priceEntry?.price || (typeof priceEntry === 'number' ? priceEntry : 0);
        if (basePrice > 0) {
          items.push({ label: 'Venue Base', price: basePrice });
        }
      }
    }

    // Category items
    const categoryLabels = {
      catering: 'Catering',
      spirits: 'Bar & Spirits',
      photography: 'Photography',
      planning: 'Planning & Coordination',
      florals: 'Florals',
      decor: 'Decorations',
      entertainment: 'Entertainment',
      videography: 'Videography',
      desserts: 'Desserts',
      linens: 'Table Linens',
      tableware: 'Tableware'
    };

    Object.entries(categoryLabels).forEach(([key, label]) => {
      if (selections[key]) {
        const options = getOptionsForCategory(key);
        const selected = options.find(o => o.label === selections[key]);
        if (selected) {
          let price = 0;
          if (selected.price_type === 'per_person') {
            price = selected.price * guestCount;
          } else if (selected.price_type === 'flat_plus_per_person') {
            price = selected.price + (selected.extra_pp || 0) * guestCount;
          } else {
            price = selected.price || 0;
          }
          if (price > 0) {
            items.push({ label, price });
          }
        }
      }
    });

    // Extras
    if (selections.extras > 0) {
      items.push({ label: 'Extras Budget', price: selections.extras });
    }

    return items;
  };

  if (submitted) {
    const itemizedBreakdown = getItemizedBreakdown();
    const visibleItems = showAllSelections ? itemizedBreakdown : itemizedBreakdown.slice(0, 4);
    const hiddenCount = itemizedBreakdown.length - 4;
    
    const canSave = contactInfo.name && 
      ((contactInfo.deliveryPreference === 'email' && contactInfo.email) ||
       (contactInfo.deliveryPreference === 'text' && contactInfo.phone));

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 mb-4"
      >
        {/* Header */}
        <h3 className="text-xl font-semibold text-stone-900 mb-1 text-center">
          Your Wedding Budget Estimate
        </h3>
        
        {/* Total */}
        <div className="text-4xl font-bold text-stone-900 text-center my-4">
          ${totalBudget.toLocaleString()}
        </div>

        {/* Itemized Breakdown Card */}
        <div className="bg-stone-50 rounded-xl p-5 mb-6">
          {/* Summary Info */}
          <div className="space-y-1 text-sm mb-4">
            <p>
              <span className="text-stone-600">Package:</span>{' '}
              <span className="font-medium text-stone-900">
                {GUEST_TIERS.find(t => t.id === selections.guestTier)?.label} ({selections.guestCount} guests)
              </span>
            </p>
            <p>
              <span className="text-stone-600">Day:</span>{' '}
              <span className="font-medium text-stone-900">
                {ALL_DAYS.find(d => d.id === selections.dayOfWeek)?.label}
              </span>
            </p>
            <p>
              <span className="text-stone-600">Season:</span>{' '}
              <span className="font-medium text-stone-900">
                {ALL_SEASONS.find(s => s.id === selections.season)?.label}
              </span>
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-stone-200 my-4"></div>

          {/* Line Items with Dotted Leaders */}
          <div className="space-y-2">
            {visibleItems.map((item, idx) => (
              <div key={idx} className="flex items-baseline text-sm">
                <span className="text-stone-700">{item.label}</span>
                <span className="flex-1 border-b border-dotted border-stone-300 mx-2 mb-1"></span>
                <span className="font-medium text-stone-900">${item.price.toLocaleString()}</span>
              </div>
            ))}
          </div>

          {/* Expand/Collapse */}
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowAllSelections(!showAllSelections)}
              className="w-full text-center text-sm text-stone-600 hover:text-black font-medium pt-4 flex items-center justify-center gap-1"
            >
              {showAllSelections ? (
                <>▲ View less</>
              ) : (
                <>▼ View more ({hiddenCount} more items)</>
              )}
            </button>
          )}
        </div>

        {/* Contact Form Card */}
        <div className="bg-stone-50 rounded-xl p-5 mb-6">
          <p className="text-sm font-medium text-stone-900 mb-4">
            To receive your personalized estimate:
          </p>
          
          <div className="space-y-4">
            <Input
              placeholder="First Name *"
              value={contactInfo.name}
              onChange={(e) => setContactInfo({ ...contactInfo, name: e.target.value })}
              className="h-12 rounded-xl bg-white"
            />
            
            <div className="space-y-2">
              <p className="text-sm text-stone-600">How would you like to receive it?</p>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="email"
                    checked={contactInfo.deliveryPreference === 'email'}
                    onChange={(e) => setContactInfo({ ...contactInfo, deliveryPreference: e.target.value })}
                    className="w-4 h-4 accent-black"
                  />
                  <span className="text-sm text-stone-700">Email me</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="text"
                    checked={contactInfo.deliveryPreference === 'text'}
                    onChange={(e) => setContactInfo({ ...contactInfo, deliveryPreference: e.target.value })}
                    className="w-4 h-4 accent-black"
                  />
                  <span className="text-sm text-stone-700">Text me</span>
                </label>
              </div>
            </div>

            {contactInfo.deliveryPreference === 'email' && (
              <Input
                type="email"
                placeholder="Email Address *"
                value={contactInfo.email}
                onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                className="h-12 rounded-xl bg-white"
              />
            )}

            {contactInfo.deliveryPreference === 'text' && (
              <Input
                type="tel"
                placeholder="Phone Number *"
                value={contactInfo.phone}
                onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                className="h-12 rounded-xl bg-white"
              />
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={handleEdit}
            variant="outline"
            className="flex-1 rounded-full h-12"
            disabled={saving}
          >
            Edit
          </Button>
          <Button
            onClick={handleSaveAndSend}
            disabled={!canSave || saving}
            className="flex-1 rounded-full h-12 bg-black hover:bg-stone-800 gap-2"
          >
            <Mail className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save & Send'}
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 mb-4">

      <ProgressDots current={step} total={steps.length} />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="mt-4">

          <div className="mb-2">
            <h3 className="text-lg font-semibold text-stone-900">{currentStep.title}</h3>
          </div>
          <p className="text-stone-600 mb-4">{currentStep.question}</p>

          {currentStep.restriction &&
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
              {currentStep.restriction}
            </div>
          }

          {currentStep.type === 'extras' ? (
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
              <div className="space-y-3">
                <div className="text-center">
                  <span className="text-lg text-stone-600 mr-2">$</span>
                  <input
                    type="number"
                    value={selections.extras || 0}
                    onChange={(e) => {
                      const value = Math.max(0, Math.min(10000, parseInt(e.target.value) || 0));
                      setSelections(prev => ({ ...prev, extras: value }));
                    }}
                    className="text-3xl font-bold text-stone-900 bg-transparent text-center w-32 border-b-2 border-stone-300 focus:border-black outline-none"
                    min={0}
                    max={10000}
                    step={500}
                  />
                </div>
                <div className="relative">
                  <input
                    type="range"
                    value={selections.extras || 0}
                    onChange={(e) => setSelections(prev => ({ ...prev, extras: parseInt(e.target.value) }))}
                    min={0}
                    max={10000}
                    step={500}
                    className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer 
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 
                      [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-black 
                      [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white 
                      [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 
                      [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-black 
                      [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white 
                      [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-stone-500 mt-1">
                    <span>$0</span>
                    <span>$10,000</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {currentOptions.map((option) => {
                const optionKey = option.id ?? option.label;
                const isSelected = selections[currentStep.key] === optionKey;
                const displayLabel = option.label || option.id;
                const priceDisplay = formatPrice(option);
                const sublabel = option.sublabel;

                return (
                  <button
                    key={optionKey}
                    onClick={() => handleSelect(optionKey)}
                    className={`w-full p-4 rounded-xl text-left transition-all ${
                    isSelected ?
                    'bg-black text-white' :
                    'bg-stone-50 hover:bg-stone-100 text-stone-700'}`
                    }>

                    <p className="font-medium">{displayLabel}{priceDisplay}</p>
                    {sublabel &&
                    <p className={`text-sm mt-1 ${isSelected ? 'text-stone-300' : 'text-stone-500'}`}>
                        {sublabel}
                      </p>
                    }
                  </button>);

              })}
            </div>
          )}

          {currentStep.type === 'guest_tier' && selections.guestTier && selections.guestTier !== 'up_to_2' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 p-4 bg-stone-50 rounded-xl border border-stone-200"
            >
              <p className="text-sm font-medium text-stone-900 mb-3">
                Approximately how many guests are you expecting?
              </p>
              <div className="space-y-3">
                <div className="text-center">
                  <input
                    type="number"
                    value={selections.guestCount || ''}
                    onChange={(e) => handleGuestCountChange(e.target.value)}
                    className="text-3xl font-bold text-stone-900 bg-transparent text-center w-24 border-b-2 border-stone-300 focus:border-black outline-none"
                    min={TIER_RANGES[selections.guestTier]?.min}
                    max={TIER_RANGES[selections.guestTier]?.max}
                  />
                  <span className="text-lg text-stone-600 ml-2">guests</span>
                </div>
                <div className="relative">
                  <input
                    type="range"
                    value={selections.guestCount || TIER_RANGES[selections.guestTier]?.default}
                    onChange={(e) => handleGuestCountChange(e.target.value)}
                    min={TIER_RANGES[selections.guestTier]?.min}
                    max={TIER_RANGES[selections.guestTier]?.max}
                    className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer 
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 
                      [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-black 
                      [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white 
                      [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 
                      [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-black 
                      [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white 
                      [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-stone-500 mt-1">
                    <span>{TIER_RANGES[selections.guestTier]?.min}</span>
                    <span>{TIER_RANGES[selections.guestTier]?.max}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentOptions.length === 0 && currentStep.type === 'day_of_week' &&
          <div className="bg-stone-100 rounded-xl p-4 text-center">
              <p className="text-stone-600">Please select a season first to see available days.</p>
            </div>
          }

          {currentOptions.length === 0 && currentStep.type === 'category' &&
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <p className="text-amber-800">⚠️ Options not found for {currentStep.title}. Check console for debug info.</p>
            </div>
          }

          {selections.guestTier && selections.dayOfWeek && selections.season &&
          <div className="mt-6 p-4 bg-stone-50 rounded-lg border border-stone-200">
              <p className="text-sm text-stone-600">Running total:</p>
              <p className="text-2xl font-bold text-stone-900">
                {totalBudget > 0 ? `$${totalBudget.toLocaleString()}` : 'Calculating...'}
              </p>
            </div>
          }
        </motion.div>
      </AnimatePresence>

      <div className="flex gap-2 mt-6">
        <Button
          onClick={handleBack}
          variant="outline"
          className="flex-1 rounded-full">

          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        <Button
          onClick={handleNext}
          disabled={!canContinue}
          className="flex-1 rounded-full bg-black hover:bg-stone-800 disabled:bg-stone-300">

          {step === steps.length - 1 ? 'See Total' : 'Continue'}
        </Button>
      </div>
    </motion.div>);

}