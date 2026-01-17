import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Check, Users, Clock, Sparkles } from 'lucide-react';

const packages = [
  {
    id: 'intimate_garden',
    name: 'Intimate Garden',
    price: 8500,
    maxGuests: 50,
    features: [
      'Ceremony space',
      'Garden reception',
      '4-hour rental',
      'Basic chairs & tables',
      'Bridal suite',
    ],
  },
  {
    id: 'classic_elegance',
    name: 'Classic Elegance',
    price: 15000,
    maxGuests: 120,
    popular: true,
    features: [
      'Ceremony & reception',
      '6-hour rental',
      'Premium furniture',
      'Both suites',
      'Day-of coordinator',
      'String lighting',
    ],
  },
  {
    id: 'grand_estate',
    name: 'Grand Estate',
    price: 25000,
    maxGuests: 250,
    features: [
      'Full estate access',
      '10-hour rental',
      'Luxury furniture',
      'Both suites',
      'Full coordination',
      'Custom lighting',
      'Valet parking',
      'Rehearsal dinner space',
    ],
  },
];

export default function PackagesView({ onScheduleTour, onCancel }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4"
    >
      <div className="space-y-4">
        {packages.map((pkg, index) => (
          <motion.div
            key={pkg.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`bg-white rounded-2xl p-5 shadow-sm border ${
              pkg.popular ? 'border-black ring-1 ring-black' : 'border-stone-100'
            } relative`}
          >
            {pkg.popular && (
              <div className="absolute -top-3 left-4 px-3 py-1 bg-black text-white text-xs font-medium rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Most Popular
              </div>
            )}
            
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-lg font-semibold text-stone-900">{pkg.name}</h3>
                <div className="flex items-center gap-3 mt-1 text-sm text-stone-500">
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    Up to {pkg.maxGuests} guests
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-stone-900">${pkg.price.toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-2">
              {pkg.features.map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm text-stone-600">
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                  {feature}
                </div>
              ))}
            </div>

            <Button
              onClick={() => onScheduleTour(pkg.name)}
              className="w-full mt-4 rounded-full bg-black hover:bg-stone-800"
            >
              Schedule a Tour
            </Button>
          </motion.div>
        ))}
      </div>

      <Button
        onClick={onCancel}
        variant="outline"
        className="w-full mt-4 rounded-full"
      >
        Back to Chat
      </Button>
    </motion.div>
  );
}