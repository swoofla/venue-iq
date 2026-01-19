import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Check, Users, Sparkles, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

export default function PackagesView({ venueId, onScheduleTour, onCancel }) {
  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['packages', venueId],
    queryFn: async () => {
      const pkgs = await base44.entities.VenuePackage.filter({ 
        venue_id: venueId,
        is_active: true 
      });
      return pkgs.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    },
    enabled: !!venueId
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-stone-100 mb-4">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 text-stone-400 animate-spin" />
          <span className="text-stone-600">Loading packages...</span>
        </div>
      </div>
    );
  }

  if (packages.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-stone-100 mb-4 text-center">
        <h3 className="text-lg font-semibold text-stone-900 mb-2">No Packages Available</h3>
        <p className="text-stone-600 mb-4">Contact us to learn about our offerings!</p>
        <Button onClick={onCancel} className="rounded-full bg-black hover:bg-stone-800">
          Back to Chat
        </Button>
      </div>
    );
  }
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
                    Up to {pkg.max_guests} guests
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-stone-900">${pkg.price.toLocaleString()}</p>
              </div>
            </div>

            {pkg.description && (
              <p className="text-sm text-stone-600 mb-3">{pkg.description}</p>
            )}

            {pkg.includes && pkg.includes.length > 0 && (
              <div className="space-y-2">
                {pkg.includes.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-stone-600">
                    <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                    {feature}
                  </div>
                ))}
              </div>
            )}

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