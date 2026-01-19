import React from 'react';

const LABELS = {
  guestTier: 'Package',
  dayOfWeek: 'Day',
  season: 'Season',
  spirits: 'Spirits',
  planning: 'Planning',
  catering: 'Catering',
  photography: 'Photography',
  florals: 'Florals',
  decor: 'Decor',
  entertainment: 'Entertainment',
  videography: 'Videography',
  desserts: 'Desserts',
  linens: 'Linens',
  tableware: 'Tableware',
  extras: 'Extras'
};

const TIER_LABELS = {
  'up_to_2': 'Just us two (1-2)',
  '2_to_20': 'Inner Circle (3-20)',
  '20_to_50': '50 and Under (21-50)',
  '51_to_120': 'Classic Wedding (51-120)'
};

export default function BudgetSummaryBreakdown({ selections, totalBudget, onEditCategory, pricingConfig }) {
  // Helper to get venue base price
  const getVenueBasePrice = () => {
    if (!pricingConfig || !selections.guestTier || !selections.dayOfWeek || !selections.season) return null;
    
    const venueBase = pricingConfig.pricing_data?.venue_base || pricingConfig.venue_base;
    if (!venueBase) return null;

    const tierPricing = venueBase[selections.guestTier];
    if (!tierPricing) return null;

    const seasonKey = selections.season === 'peak' ? 'peak' : 'non_peak';
    const key = `${selections.dayOfWeek}_${seasonKey}`;
    const priceEntry = tierPricing[key];
    
    return priceEntry?.price || priceEntry || null;
  };

  // Helper to get category price
  const getCategoryPrice = (category) => {
    if (!pricingConfig || !selections.guestTier || !selections[category]) return null;
    
    const categoryData = pricingConfig.pricing_data?.[category] || pricingConfig[category];
    if (!categoryData) return null;

    let options = [];
    if (categoryData[selections.guestTier]) {
      options = categoryData[selections.guestTier];
    } else if (Array.isArray(categoryData)) {
      const tierData = categoryData.find(t => t.guest_tier === selections.guestTier);
      options = tierData?.options || [];
    }

    const selected = options.find(o => o.label === selections[category]);
    if (!selected) return null;

    const guestCount = selections.guestCount || 2;
    if (selected.price_type === 'per_person') {
      return selected.price * guestCount;
    } else if (selected.price_type === 'flat_plus_per_person') {
      return selected.price + (selected.extra_pp || 0) * guestCount;
    }
    return selected.price || null;
  };

  const venueBasePrice = getVenueBasePrice();

  const rows = [
    { category: 'Package', selection: TIER_LABELS[selections.guestTier] || selections.guestTier, price: null },
    { category: 'Season', selection: selections.season === 'peak' ? 'Peak Season' : 'Non-Peak Season', price: null },
    { category: 'Day', selection: selections.dayOfWeek?.charAt(0).toUpperCase() + selections.dayOfWeek?.slice(1), price: null },
    { category: 'Venue Base', selection: '-', price: venueBasePrice }
  ];

  const categories = ['spirits', 'planning', 'catering', 'photography', 'florals', 'decor', 'entertainment', 'videography', 'desserts', 'linens', 'tableware'];
  
  categories.forEach(cat => {
    if (selections[cat]) {
      rows.push({
        category: LABELS[cat],
        selection: selections[cat],
        price: getCategoryPrice(cat)
      });
    }
  });

  if (selections.extras && selections.extras > 0) {
    rows.push({
      category: 'Extras',
      selection: '-',
      price: selections.extras
    });
  }

  return (
    <div className="bg-white rounded-xl overflow-hidden border border-stone-200">
      <div className="p-4 border-b border-stone-200">
        <h3 className="text-xl font-semibold text-stone-900">Full Budget Breakdown</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-stone-200">
              <th className="text-left py-3 px-4 text-sm font-medium text-stone-600">Category</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-stone-600">Your Selection</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-stone-600">Price</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="border-b border-stone-100">
                <td className="py-3 px-4 text-sm text-stone-900">{row.category}</td>
                <td className="py-3 px-4 text-sm text-stone-600">{row.selection}</td>
                <td className="py-3 px-4 text-sm text-right text-stone-900">
                  {row.price !== null ? `$${row.price.toLocaleString()}` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-stone-50">
              <td className="py-4 px-4 text-base font-semibold text-stone-900">TOTAL</td>
              <td className="py-4 px-4"></td>
              <td className="py-4 px-4 text-right text-xl font-bold text-stone-900">
                ${totalBudget.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}