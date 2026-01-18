import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, RotateCcw, Send, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const TIER_LABELS = {
  'up_to_2': 'Just us two 💕',
  '2_to_20': 'Inner Circle',
  '20_to_50': '50 and Under',
  '51_to_120': 'Classic Wedding'
};

export default function AdminBudgetEstimates() {
  const [expandedId, setExpandedId] = useState(null);
  const [filterTier, setFilterTier] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [retryingId, setRetryingId] = useState(null);

  const { data: estimates = [], isLoading, refetch } = useQuery({
    queryKey: ['budgetEstimates'],
    queryFn: () => base44.entities.SavedBudgetEstimate.list(),
  });

  const filteredEstimates = estimates
    .filter(e => filterTier === 'all' || e.guest_tier === filterTier)
    .sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.created_date) - new Date(a.created_date);
      } else if (sortBy === 'budget') {
        return b.total_budget - a.total_budget;
      }
      return 0;
    });

  const handleRetrySync = async (estimateId) => {
    setRetryingId(estimateId);
    try {
      const estimate = estimates.find(e => e.id === estimateId);
      
      // Attempt HighLevel sync
      const highlevelApiKey = Deno.env?.get?.('HIGHLEVEL_API_KEY');
      if (highlevelApiKey) {
        const contactResponse = await fetch('https://rest.gohighlevel.com/v2/contacts/upsert', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${highlevelApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            locationId: Deno.env?.get?.('HIGHLEVEL_LOCATION_ID'),
            email: estimate.email || undefined,
            phone: estimate.phone || undefined,
            firstName: estimate.name.split(' ')[0],
            lastName: estimate.name.split(' ').slice(1).join(' '),
            customFields: {
              budgetEstimate: estimate.total_budget.toString(),
              budgetPackage: estimate.guest_tier,
              budgetSource: 'budget_calculator'
            }
          })
        });

        if (contactResponse.ok) {
          const contactData = await contactResponse.json();
          await base44.entities.SavedBudgetEstimate.update(estimateId, {
            highlevel_sync_status: 'synced',
            highlevel_contact_id: contactData.contact?.id
          });
        } else {
          throw new Error('HighLevel sync failed');
        }
      }

      refetch();
    } catch (error) {
      console.error('Retry sync error:', error);
    } finally {
      setRetryingId(null);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Contact', 'Guest Tier', 'Total Budget', 'Date', 'Status'];
    const rows = filteredEstimates.map(e => [
      e.name,
      e.email || e.phone || 'N/A',
      TIER_LABELS[e.guest_tier] || e.guest_tier,
      `$${e.total_budget.toLocaleString()}`,
      new Date(e.created_date).toLocaleDateString(),
      e.highlevel_sync_status
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-estimates-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  if (isLoading) {
    return <div className="p-6 text-center text-stone-600">Loading budget estimates...</div>;
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-stone-900">Budget Estimates</h1>
            <p className="text-stone-600 mt-1">Manage and track all saved wedding budget estimates</p>
          </div>
          <Button onClick={handleExportCSV} variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-4 mb-6">
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-2">Filter by Tier</label>
              <select
                value={filterTier}
                onChange={(e) => setFilterTier(e.target.value)}
                className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
              >
                <option value="all">All Tiers</option>
                <option value="up_to_2">Just us two 💕</option>
                <option value="2_to_20">Inner Circle</option>
                <option value="20_to_50">50 and Under</option>
                <option value="51_to_120">Classic Wedding</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-2">Sort by</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
              >
                <option value="recent">Most Recent</option>
                <option value="budget">Highest Budget</option>
              </select>
            </div>
          </div>
        </div>

        {/* List */}
        {filteredEstimates.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-stone-200">
            <p className="text-stone-600">No budget estimates yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEstimates.map((estimate) => (
              <motion.div key={estimate.id} layout>
                <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
                  {/* Summary Row */}
                  <button
                    onClick={() => setExpandedId(expandedId === estimate.id ? null : estimate.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-stone-50 transition-colors text-left"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium text-stone-900">{estimate.name}</p>
                          <p className="text-sm text-stone-600">
                            {estimate.email || estimate.phone || 'No contact'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="font-semibold text-stone-900">
                          ${estimate.total_budget.toLocaleString()}
                        </p>
                        <p className="text-xs text-stone-600">
                          {TIER_LABELS[estimate.guest_tier] || estimate.guest_tier}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {estimate.highlevel_sync_status === 'synced' ? (
                          <div className="flex items-center gap-1 px-2 py-1 bg-green-50 rounded-lg">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-xs font-medium text-green-700">Synced</span>
                          </div>
                        ) : estimate.highlevel_sync_status === 'failed' ? (
                          <div className="flex items-center gap-1 px-2 py-1 bg-red-50 rounded-lg">
                            <AlertCircle className="w-4 h-4 text-red-600" />
                            <span className="text-xs font-medium text-red-700">Failed</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 rounded-lg">
                            <AlertCircle className="w-4 h-4 text-amber-600" />
                            <span className="text-xs font-medium text-amber-700">Pending</span>
                          </div>
                        )}
                        <ChevronDown
                          className={`w-5 h-5 text-stone-400 transition-transform ${
                            expandedId === estimate.id ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </div>
                  </button>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {expandedId === estimate.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-stone-200 bg-stone-50 p-4"
                      >
                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-stone-600 uppercase tracking-wide">Guest Count</p>
                            <p className="font-medium text-stone-900">{estimate.guest_count} guests</p>
                          </div>
                          <div>
                            <p className="text-xs text-stone-600 uppercase tracking-wide">Wedding Day</p>
                            <p className="font-medium text-stone-900 capitalize">
                              {estimate.day_of_week}, {estimate.season === 'peak' ? 'Peak' : 'Non-Peak'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-stone-600 uppercase tracking-wide">Delivery Method</p>
                            <p className="font-medium text-stone-900 capitalize">
                              {estimate.delivery_preference === 'email' ? '📧 Email' : '💬 SMS'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-stone-600 uppercase tracking-wide">Submitted</p>
                            <p className="font-medium text-stone-900">
                              {new Date(estimate.created_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        {/* Budget Breakdown */}
                        <div className="mb-4 bg-white rounded p-3">
                          <p className="text-sm font-medium text-stone-900 mb-2">Budget Selections</p>
                          <div className="space-y-1">
                            {Object.entries(estimate.budget_selections || {})
                              .filter(([key, value]) => value && !['guestCount', 'totalBudget'].includes(key))
                              .map(([key, value]) => (
                                <div key={key} className="flex justify-between text-xs text-stone-700">
                                  <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                                  <span>{value}</span>
                                </div>
                              ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          {estimate.highlevel_sync_status === 'failed' && (
                            <Button
                              onClick={() => handleRetrySync(estimate.id)}
                              disabled={retryingId === estimate.id}
                              variant="outline"
                              className="flex-1 gap-2"
                            >
                              <RotateCcw className="w-4 h-4" />
                              {retryingId === estimate.id ? 'Retrying...' : 'Retry Sync'}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            className="flex-1 gap-2"
                            onClick={() => {
                              // TODO: Implement resend
                            }}
                          >
                            <Send className="w-4 h-4" />
                            Resend to Lead
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}