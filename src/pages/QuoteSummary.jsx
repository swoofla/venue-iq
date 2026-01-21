import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { 
  Calendar, Users, Sun, Snowflake, 
  Wine, Camera, Flower2, Music, Video, Cake, 
  Sparkles, Phone, MapPin, Clock, ChevronDown, ChevronUp,
  Loader2
} from 'lucide-react';

// Icons for each category
const CATEGORY_ICONS = {
  guestCount: Users,
  dayOfWeek: Calendar,
  season: Sun,
  spirits: Wine,
  planning: Clock,
  catering: Cake,
  photography: Camera,
  florals: Flower2,
  decor: Sparkles,
  entertainment: Music,
  videography: Video,
  desserts: Cake,
  linens: Sparkles,
  tableware: Sparkles,
  extras: Sparkles
};

// Friendly labels
const CATEGORY_LABELS = {
  guestCount: 'Guest Count',
  dayOfWeek: 'Day of Week',
  season: 'Season',
  spirits: 'Spirits & Beverages',
  planning: 'Planning Services',
  catering: 'Catering',
  photography: 'Photography',
  florals: 'Florals',
  decor: 'Decorations',
  entertainment: 'Entertainment',
  videography: 'Videography',
  desserts: 'Desserts',
  linens: 'Table Linens',
  tableware: 'Tableware',
  extras: 'Extras Budget'
};

// Format day of week
const formatDayOfWeek = (day) => {
  const days = {
    saturday: 'Saturday',
    friday: 'Friday',
    sunday: 'Sunday',
    weekday: 'Weekday (Mon-Thu)'
  };
  return days[day] || day;
};

// Format season
const formatSeason = (season) => {
  const seasons = {
    peak: 'Peak Season (May - October)',
    nonpeak: 'Off-Peak Season (November - April)'
  };
  return seasons[season] || season;
};

export default function QuoteSummary() {
  const { quoteId } = useParams();
  const [estimate, setEstimate] = useState(null);
  const [venue, setVenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAllDetails, setShowAllDetails] = useState(false);

  useEffect(() => {
    async function fetchQuote() {
      try {
        // Fetch the saved budget estimate
        const estimates = await base44.entities.SavedBudgetEstimate.filter({ id: quoteId });
        
        if (!estimates || estimates.length === 0) {
          setError('Quote not found');
          setLoading(false);
          return;
        }

        const estimateData = estimates[0];
        setEstimate(estimateData);

        // Fetch venue info
        if (estimateData.venue_id) {
          try {
            const venueData = await base44.entities.Venue.get(estimateData.venue_id);
            setVenue(venueData);
          } catch (e) {
            // Default venue info if fetch fails
            setVenue({ name: 'Sugar Lake Weddings', phone: '(216) 616-1598' });
          }
        }
      } catch (err) {
        console.error('Failed to fetch quote:', err);
        setError('Unable to load quote');
      } finally {
        setLoading(false);
      }
    }

    if (quoteId) {
      fetchQuote();
    }
  }, [quoteId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-stone-400 mx-auto mb-4" />
          <p className="text-stone-600">Loading your quote...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-stone-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-stone-400" />
          </div>
          <h1 className="text-xl font-semibold text-stone-900 mb-2">Quote Not Found</h1>
          <p className="text-stone-600 mb-6">
            This quote may have expired or the link is incorrect. Please contact us for a new estimate.
          </p>
          <a href="tel:+12166161598">
            <Button className="rounded-full bg-black hover:bg-stone-800">
              <Phone className="w-4 h-4 mr-2" />
              Call (216) 616-1598
            </Button>
          </a>
        </div>
      </div>
    );
  }

  const venueName = venue?.name || 'Sugar Lake Weddings';
  const venuePhone = venue?.phone || '(216) 616-1598';
  const selections = estimate.budget_selections || {};
  const totalBudget = estimate.total_budget || 0;
  const firstName = estimate.name?.split(' ')[0] || 'there';
  const createdDate = estimate.created_date ? new Date(estimate.created_date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }) : null;

  // Separate core details from category selections
  const coreDetails = ['guestCount', 'dayOfWeek', 'season'];
  const categorySelections = Object.entries(selections).filter(
    ([key, value]) => value && !coreDetails.includes(key) && !['guestTier', 'extras'].includes(key)
  );
  const visibleCategories = showAllDetails ? categorySelections : categorySelections.slice(0, 4);

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-black text-white">
        <div className="max-w-lg mx-auto px-6 py-8 text-center">
          <h1 className="text-xl font-light tracking-[0.2em] mb-1">{venueName.toUpperCase()}</h1>
          <p className="text-stone-400 text-xs tracking-[0.3em]">WEDDING BUDGET ESTIMATE</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-6 -mt-6">
        {/* Total Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6"
        >
          <div className="bg-gradient-to-br from-stone-100 to-stone-50 p-8 text-center">
            <p className="text-stone-500 text-sm mb-2">Hi {firstName}! Your estimated total is</p>
            <p className="text-5xl font-bold text-stone-900 mb-2">
              ${totalBudget.toLocaleString()}
            </p>
            {createdDate && (
              <p className="text-stone-400 text-xs">Created {createdDate}</p>
            )}
          </div>

          {/* Core Details */}
          <div className="p-6 border-b border-stone-100">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <Users className="w-5 h-5 text-stone-400 mx-auto mb-2" />
                <p className="text-2xl font-semibold text-stone-900">{selections.guestCount || '—'}</p>
                <p className="text-xs text-stone-500">Guests</p>
              </div>
              <div>
                <Calendar className="w-5 h-5 text-stone-400 mx-auto mb-2" />
                <p className="text-lg font-semibold text-stone-900 capitalize">{selections.dayOfWeek || '—'}</p>
                <p className="text-xs text-stone-500">Day</p>
              </div>
              <div>
                {selections.season === 'peak' ? (
                  <Sun className="w-5 h-5 text-amber-500 mx-auto mb-2" />
                ) : (
                  <Snowflake className="w-5 h-5 text-blue-400 mx-auto mb-2" />
                )}
                <p className="text-lg font-semibold text-stone-900 capitalize">
                  {selections.season === 'peak' ? 'Peak' : 'Off-Peak'}
                </p>
                <p className="text-xs text-stone-500">Season</p>
              </div>
            </div>
          </div>

          {/* Category Selections */}
          <div className="p-6">
            <h3 className="text-sm font-semibold text-stone-900 uppercase tracking-wide mb-4">
              Your Selections
            </h3>
            <div className="space-y-4">
              {visibleCategories.map(([key, value]) => {
                const Icon = CATEGORY_ICONS[key] || Sparkles;
                const label = CATEGORY_LABELS[key] || key;
                return (
                  <div key={key} className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-stone-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-stone-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-stone-500 uppercase tracking-wide">{label}</p>
                      <p className="text-sm text-stone-900 leading-snug">{value}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Show More/Less */}
            {categorySelections.length > 4 && (
              <button
                onClick={() => setShowAllDetails(!showAllDetails)}
                className="w-full mt-4 py-3 flex items-center justify-center gap-2 text-sm text-stone-600 hover:text-stone-900 transition-colors"
              >
                {showAllDetails ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    Show {categorySelections.length - 4} more selections
                  </>
                )}
              </button>
            )}

            {/* Extras */}
            {selections.extras > 0 && (
              <div className="mt-4 pt-4 border-t border-stone-100 flex items-center justify-between">
                <span className="text-sm text-stone-600">Extras Budget</span>
                <span className="text-sm font-medium text-stone-900">${selections.extras.toLocaleString()}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* CTA Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg p-6 mb-6"
        >
          <h3 className="text-lg font-semibold text-stone-900 mb-2 text-center">
            Ready to see the space?
          </h3>
          <p className="text-stone-600 text-sm text-center mb-6">
            Schedule a tour and let's bring your vision to life.
          </p>
          <a href="https://sugarlakeweddings.com/tour" className="block">
            <Button className="w-full h-12 rounded-full bg-black hover:bg-stone-800 text-base">
              <MapPin className="w-4 h-4 mr-2" />
              Schedule a Tour
            </Button>
          </a>
        </motion.div>

        {/* Contact Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-stone-100 rounded-2xl p-6 mb-8 text-center"
        >
          <p className="text-stone-600 text-sm mb-3">
            Questions about your estimate?
          </p>
          <a 
            href={`tel:${venuePhone.replace(/\D/g, '')}`}
            className="inline-flex items-center gap-2 text-stone-900 font-medium hover:text-black transition-colors"
          >
            <Phone className="w-4 h-4" />
            {venuePhone}
          </a>
        </motion.div>

        {/* Disclaimer */}
        <p className="text-xs text-stone-400 text-center pb-8 px-4">
          This estimate is based on your selections and current pricing. 
          Final pricing may vary based on specific requirements and availability.
        </p>
      </main>
    </div>
  );
}