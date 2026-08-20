import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const TIMEZONES = [
  ['America/New_York', 'Eastern — America/New_York'],
  ['America/Chicago', 'Central — America/Chicago'],
  ['America/Denver', 'Mountain — America/Denver'],
  ['America/Phoenix', 'Arizona — America/Phoenix'],
  ['America/Los_Angeles', 'Pacific — America/Los_Angeles'],
  ['America/Anchorage', 'Alaska — America/Anchorage'],
  ['Pacific/Honolulu', 'Hawaii — Pacific/Honolulu'],
];

export default function VenueEditForm({ venue, onClose }) {
  const [formData, setFormData] = useState({
    name: venue.name || '',
    slug: venue.slug || '',
    location: venue.location || '',
    planner_name: venue.planner_name || '',
    timezone: venue.timezone || 'America/New_York',
  });
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Venue.update(venue.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      toast.success('Venue updated');
      onClose();
    },
    onError: (err) => toast.error(err?.message || 'Update failed'),
  });

  return (
    <div className="mt-4 pt-4 border-t border-stone-200 space-y-3">
      <div>
        <Label className="text-xs">Venue name</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </div>
      <div>
        <Label className="text-xs">Slug</Label>
        <Input
          value={formData.slug}
          onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
          placeholder="sugar-lake-weddings"
        />
        <p className="text-xs text-stone-500 mt-1">
          Chatbot link: <code>?venue={formData.slug || 'your-slug'}</code>
        </p>
      </div>
      <div>
        <Label className="text-xs">Location</Label>
        <Input
          value={formData.location}
          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
        />
      </div>
      <div>
        <Label className="text-xs">Planner name</Label>
        <Input
          value={formData.planner_name}
          onChange={(e) => setFormData({ ...formData, planner_name: e.target.value })}
          placeholder="Saydee"
        />
      </div>
      <div>
        <Label className="text-xs">Timezone</Label>
        <Select value={formData.timezone} onValueChange={(v) => setFormData({ ...formData, timezone: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
        <Button
          onClick={() => saveMutation.mutate(formData)}
          className="flex-1"
          disabled={!formData.name || !formData.slug || saveMutation.isPending}
        >
          {saveMutation.isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}