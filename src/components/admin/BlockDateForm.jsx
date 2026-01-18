import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function BlockDateForm({ date, onClose }) {
  const [formData, setFormData] = useState({
    date: date || '',
    reason: ''
  });

  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.BlockedDate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['blocked']);
      onClose();
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  return (
    <div className="max-w-md mx-auto bg-white border border-stone-200 rounded-2xl p-6">
      <h3 className="text-xl font-semibold mb-6">Block Date</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Date *</label>
          <Input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
            min={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Reason</label>
          <Input
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            placeholder="e.g., Venue maintenance, Holiday closure"
          />
        </div>

        <div className="flex gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" className="flex-1 bg-black hover:bg-stone-800">
            Block Date
          </Button>
        </div>
      </form>
    </div>
  );
}