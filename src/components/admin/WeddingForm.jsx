import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function WeddingForm({ date, wedding, venueId, onClose }) {
  const [formData, setFormData] = useState({
    date: wedding?.date || date || '',
    end_date: wedding?.end_date || wedding?.date || date || '',
    couple_name: wedding?.couple_name || '',
    email: wedding?.email || '',
    phone: wedding?.phone || '',
    guest_count: wedding?.guest_count || '',
    package: wedding?.package || '',
    notes: wedding?.notes || '',
    deposit_paid: wedding?.deposit_paid || false
  });

  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (!venueId) throw new Error('No venue selected');
      if (!data.date || !data.end_date || data.end_date < data.date) throw new Error('End date must be on or after the start date.');
      const dataWithVenue = { ...data, venue_id: venueId };
      if (dataWithVenue.guest_count === '') delete dataWithVenue.guest_count;
      if (!dataWithVenue.package) delete dataWithVenue.package;
      if (wedding) {
        return base44.entities.BookedWeddingDate.update(wedding.id, dataWithVenue);
      }
      return base44.entities.BookedWeddingDate.create(dataWithVenue);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weddings'] });
      queryClient.invalidateQueries({ queryKey: ['bookedDates'] });
      onClose();
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!venueId) return;
    saveMutation.mutate(formData);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white border border-stone-200 rounded-2xl p-6">
      <h3 className="text-xl font-semibold mb-6">
        {wedding ? 'Edit Wedding Booking' : 'Book Wedding'}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2" htmlFor="booking-start">Start date *</label>
          <Input
            id="booking-start"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value, end_date: !formData.end_date || formData.end_date < e.target.value ? e.target.value : formData.end_date })}
            required
          />
        </div>

        <div>
          <label htmlFor="booking-end" className="block text-sm font-medium mb-2">End date *</label>
          <Input id="booking-end" type="date" value={formData.end_date} min={formData.date} required onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
          <p className="text-sm text-stone-600 mt-2">Every day from start through end is reserved, including both dates. Use the same date for a single-day booking.</p>
          {wedding?.google_event_id && <p className="text-sm text-stone-600 mt-2">Imported from Google Calendar. A future sync will use the dates from Google.</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Couple's Names</label>
          <Input
            value={formData.couple_name}
            onChange={(e) => setFormData({ ...formData, couple_name: e.target.value })}
            placeholder="John & Jane Smith"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="couple@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Phone</label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="(555) 123-4567"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Guest Count</label>
            <Input
              type="number"
              value={formData.guest_count}
              onChange={(e) => setFormData({ ...formData, guest_count: Number(e.target.value) })}
              placeholder="50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Package</label>
            <Select
              value={formData.package}
              onValueChange={(value) => setFormData({ ...formData, package: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select package" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="intimate_garden">Intimate Garden</SelectItem>
                <SelectItem value="classic_elegance">Classic Elegance</SelectItem>
                <SelectItem value="grand_estate">Grand Estate</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Notes</label>
          <Textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Additional notes..."
            rows={3}
          />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            checked={formData.deposit_paid}
            onCheckedChange={(checked) => setFormData({ ...formData, deposit_paid: checked })}
            id="deposit"
          />
          <label htmlFor="deposit" className="text-sm font-medium cursor-pointer">
            Deposit Paid
          </label>
        </div>

        {!venueId && (
          <p className="text-sm text-red-600">
            No venue selected — cannot save. Reload the page.
          </p>
        )}

        {saveMutation.error && <p role="alert" className="text-red-600">{saveMutation.error.message}</p>}
        <div className="flex gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={!venueId || saveMutation.isPending || !formData.date || !formData.end_date || formData.end_date < formData.date} className="flex-1 bg-black hover:bg-stone-800">
            {saveMutation.isPending ? 'Saving…' : wedding ? 'Update Wedding' : 'Save Wedding'}
          </Button>
        </div>
      </form>
    </div>
  );
}