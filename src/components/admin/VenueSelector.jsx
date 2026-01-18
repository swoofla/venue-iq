import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2 } from 'lucide-react';

export default function VenueSelector({ onVenueSelected, user }) {
  const [selectedVenue, setSelectedVenue] = useState('');
  
  const { data: venues = [] } = useQuery({
    queryKey: ['allVenues'],
    queryFn: () => base44.entities.Venue.list()
  });

  if (!user || user.role !== 'admin' || user.venue_id) {
    return null;
  }

  const handleSelect = (venueId) => {
    setSelectedVenue(venueId);
    onVenueSelected(venueId);
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center gap-4">
      <Building2 className="w-5 h-5 text-blue-600" />
      <div className="flex-1">
        <label className="block text-sm font-medium text-blue-900 mb-2">Select a venue to manage</label>
        <Select value={selectedVenue} onValueChange={handleSelect}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a venue..." />
          </SelectTrigger>
          <SelectContent>
            {venues.map(venue => (
              <SelectItem key={venue.id} value={venue.id}>
                {venue.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}