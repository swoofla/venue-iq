import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Save, Plus, Trash2 } from 'lucide-react';

export default function PricingManager({ venueId }) {
  const queryClient = useQueryClient();
  const [pricingData, setPricingData] = useState(null);

  const { data: config, isLoading } = useQuery({
    queryKey: ['pricingConfig', venueId],
    queryFn: () => base44.entities.WeddingPricingConfiguration.filter({ venue_id: venueId }),
    onSuccess: (configs) => {
      if (configs.length > 0) {
        setPricingData(configs[0]);
      }
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (data.id) {
        return base44.entities.WeddingPricingConfiguration.update(data.id, { pricing_data: data.pricing_data });
      } else {
        return base44.entities.WeddingPricingConfiguration.create({
          venue_id: venueId,
          pricing_data: data.pricing_data,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricingConfig', venueId] });
    },
  });

  if (isLoading) return <div>Loading pricing configuration...</div>;

  const currentConfig = pricingData || config?.[0];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Wedding Pricing Configuration</h2>
        <Button
          onClick={() => saveMutation.mutate(currentConfig || { pricing_data: {} })}
          className="gap-2"
        >
          <Save className="w-4 h-4" /> Save Configuration
        </Button>
      </div>

      {/* Simplified UI with direct data editing */}
      <Card className="p-6">
        <p className="text-sm text-gray-600 mb-4">
          This interface manages complex pricing tiers. For detailed edits, please use the developer console or contact support.
        </p>
        
        {currentConfig ? (
          <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
            <pre className="text-xs whitespace-pre-wrap break-words">
              {JSON.stringify(currentConfig.pricing_data, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No pricing configuration found. Click Save to create one.
          </div>
        )}
      </Card>

      <div className="text-xs text-gray-500">
        <p>To populate this with Sugar Lake pricing data, use the data import below or contact support.</p>
      </div>
    </div>
  );
}