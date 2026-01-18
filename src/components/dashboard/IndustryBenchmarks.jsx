import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TrendingUp, Award, Calendar, DollarSign, Users, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function IndustryBenchmarks() {
  const { data: benchmarks, isLoading } = useQuery({
    queryKey: ['benchmarks'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getBenchmarkingData', {});
      return response.data;
    },
    refetchInterval: 300000 // Refresh every 5 minutes
  });

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-stone-900 to-stone-800 rounded-xl p-6 text-white">
        <h2 className="text-xl font-semibold mb-4">Industry Insights</h2>
        <p className="text-stone-300">Loading benchmarking data...</p>
      </div>
    );
  }

  if (!benchmarks) return null;

  const packageLabels = {
    'intimate_garden': 'Intimate Garden',
    'classic_elegance': 'Classic Elegance',
    'grand_estate': 'Grand Estate'
  };

  return (
    <div className="bg-gradient-to-br from-stone-900 to-stone-800 rounded-xl p-6 text-white">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-6 h-6 text-amber-400" />
        <h2 className="text-xl font-semibold">VenueIQ Industry Insights</h2>
      </div>
      <p className="text-stone-300 text-sm mb-6">
        Benchmarking data from {benchmarks.totalVenues} venues across the platform
      </p>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-stone-300">Avg Package Price</span>
          </div>
          <p className="text-2xl font-bold">${benchmarks.avgPackagePrice?.toLocaleString()}</p>
        </div>

        <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-stone-300">Avg Guest Count</span>
          </div>
          <p className="text-2xl font-bold">{benchmarks.avgGuestCount}</p>
        </div>

        <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-stone-300">Avg Budget</span>
          </div>
          <p className="text-2xl font-bold">${benchmarks.avgBudget?.toLocaleString()}</p>
        </div>

        <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-stone-300">Avg Booking Lead</span>
          </div>
          <p className="text-2xl font-bold">{benchmarks.avgBookingLeadTime} days</p>
        </div>

        <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-stone-300">Tour Conversion</span>
          </div>
          <p className="text-2xl font-bold">{benchmarks.tourConversionRate}%</p>
        </div>

        <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-stone-300">Total Inquiries</span>
          </div>
          <p className="text-2xl font-bold">{benchmarks.totalInquiries}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        {benchmarks.popularMonths && benchmarks.popularMonths.length > 0 && (
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
            <h3 className="text-sm font-semibold mb-3 text-amber-400">Most Popular Booking Months</h3>
            <div className="space-y-2">
              {benchmarks.popularMonths.map((month, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold">{idx + 1}.</span>
                  <span>{MONTH_NAMES[month]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {benchmarks.popularPackages && benchmarks.popularPackages.length > 0 && (
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
            <h3 className="text-sm font-semibold mb-3 text-amber-400">Most Popular Packages</h3>
            <div className="space-y-2">
              {benchmarks.popularPackages.map((pkg, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-bold">{idx + 1}.</span>
                    <span>{packageLabels[pkg.package] || pkg.package}</span>
                  </div>
                  <span className="text-stone-400 text-sm">{pkg.count} bookings</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {benchmarks.featureUsage && Object.keys(benchmarks.featureUsage).length > 0 && (
        <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20 mt-4">
          <h3 className="text-sm font-semibold mb-3 text-amber-400">Most Used Features</h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(benchmarks.featureUsage)
              .sort(([, a], [, b]) => b - a)
              .map(([feature, count]) => (
                <div key={feature} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{feature.replace(/_/g, ' ')}</span>
                  <span className="text-stone-400 text-sm">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}