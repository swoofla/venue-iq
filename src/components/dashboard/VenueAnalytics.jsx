import React from 'react';
import { TrendingUp, Users, Calendar, DollarSign, Clock, Target } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

export default function VenueAnalytics({ weddings, submissions, packages }) {
  // Calculate total inquiries
  const totalInquiries = submissions.length;

  // Calculate most popular package
  const packageCounts = {};
  weddings.forEach(w => {
    if (w.package) packageCounts[w.package] = (packageCounts[w.package] || 0) + 1;
  });
  const mostPopularPackage = Object.entries(packageCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A';

  // Calculate average guest count
  const guestCounts = weddings.filter(w => w.guest_count).map(w => w.guest_count);
  const avgGuestCount = guestCounts.length > 0
    ? Math.round(guestCounts.reduce((sum, g) => sum + g, 0) / guestCounts.length)
    : 0;

  // Calculate revenue pipeline
  const packagePrices = {
    'intimate_garden': packages.find(p => p.name.toLowerCase().includes('intimate'))?.price || 0,
    'classic_elegance': packages.find(p => p.name.toLowerCase().includes('classic'))?.price || 0,
    'grand_estate': packages.find(p => p.name.toLowerCase().includes('grand'))?.price || 0
  };
  const totalRevenue = weddings.reduce((sum, w) => sum + (packagePrices[w.package] || 0), 0);

  // Calculate average booking lead time
  const leadTimes = weddings
    .filter(w => w.created_date && w.date)
    .map(w => differenceInDays(new Date(w.date), new Date(w.created_date)))
    .filter(days => days > 0);
  const avgLeadTime = leadTimes.length > 0
    ? Math.round(leadTimes.reduce((sum, d) => sum + d, 0) / leadTimes.length)
    : 0;

  // Calculate tour scheduling rate
  const toursScheduled = submissions.filter(s => s.tour_date).length;
  const tourRate = totalInquiries > 0 ? Math.round((toursScheduled / totalInquiries) * 100) : 0;

  // Calculate busiest months
  const monthCounts = {};
  weddings.forEach(w => {
    const month = format(new Date(w.date), 'MMMM');
    monthCounts[month] = (monthCounts[month] || 0) + 1;
  });
  const busiestMonth = Object.entries(monthCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A';

  const metrics = [
    {
      label: 'Total Inquiries',
      value: totalInquiries,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    {
      label: 'Tour Conversion',
      value: `${tourRate}%`,
      icon: Target,
      color: 'text-green-600',
      bg: 'bg-green-50'
    },
    {
      label: 'Avg Guest Count',
      value: avgGuestCount || 'N/A',
      icon: Users,
      color: 'text-purple-600',
      bg: 'bg-purple-50'
    },
    {
      label: 'Revenue Pipeline',
      value: `$${totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50'
    },
    {
      label: 'Avg Booking Lead',
      value: avgLeadTime ? `${avgLeadTime} days` : 'N/A',
      icon: Clock,
      color: 'text-orange-600',
      bg: 'bg-orange-50'
    },
    {
      label: 'Busiest Month',
      value: busiestMonth,
      icon: Calendar,
      color: 'text-pink-600',
      bg: 'bg-pink-50'
    }
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-stone-900">Your Venue Analytics</h2>
      <div className="grid md:grid-cols-3 gap-4">
        {metrics.map((metric, idx) => (
          <div key={idx} className="bg-white border border-stone-200 rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-stone-600 mb-1">{metric.label}</p>
                <p className="text-2xl font-bold text-stone-900">{metric.value}</p>
              </div>
              <div className={`${metric.bg} p-2 rounded-lg`}>
                <metric.icon className={`w-5 h-5 ${metric.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}