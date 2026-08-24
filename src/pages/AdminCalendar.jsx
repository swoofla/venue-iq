import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Home, List } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import CalendarView from '../components/admin/CalendarView';
import WeddingForm from '../components/admin/WeddingForm';
import BlockDateForm from '../components/admin/BlockDateForm';
import VenueSelector from '../components/admin/VenueSelector';
import { useVenue } from '@/lib/VenueContext';

export default function AdminCalendar() {
  const [selectedDate, setSelectedDate] = useState(null);
  const [showWeddingForm, setShowWeddingForm] = useState(false);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [editingWedding, setEditingWedding] = useState(null);
  // Venue resolution lives in VenueContext so the shell header's switcher and
  // this page can't disagree. It already reads ?venue_id= and auth.me().
  const { user, venueId, setVenueId, userLoading } = useVenue();
  const queryClient = useQueryClient();

  const { data: weddings = [] } = useQuery({
    queryKey: ['weddings', venueId],
    queryFn: async () => {
      if (!venueId) return [];
      const result = await base44.entities.BookedWeddingDate.filter({ venue_id: venueId });
      return result;
    },
    enabled: !!venueId
  });

  const { data: blocked = [] } = useQuery({
    queryKey: ['blocked', venueId],
    queryFn: () => venueId ? base44.entities.BlockedDate.filter({ venue_id: venueId }) : [],
    enabled: !!venueId
  });

  const deleteWeddingMutation = useMutation({
    mutationFn: (id) => base44.entities.BookedWeddingDate.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['weddings'])
  });

  const deleteBlockedMutation = useMutation({
    mutationFn: (id) => base44.entities.BlockedDate.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['blocked'])
  });

  const handleDateClick = (date) => {
    const wedding = weddings.find(w => w.date === date);
    const block = blocked.find(b => b.date === date);

    if (wedding) {
      setEditingWedding(wedding);
      setShowWeddingForm(true);
    } else if (block) {
      if (confirm(`Unblock ${date}?\nReason: ${block.reason}`)) {
        deleteBlockedMutation.mutate(block.id);
      }
    } else {
      setSelectedDate(date);
    }
  };

  const handleBookWedding = () => {
    setShowWeddingForm(true);
  };

  const handleBlockDate = () => {
    setShowBlockForm(true);
  };

  const handleClearDates = async () => {
    if (!confirm('Delete all synced wedding dates? You can sync again for a fresh start.')) {
      return;
    }
    try {
      const response = await base44.functions.invoke('clearSyncedDates', { venue_id: venueId });
      alert(`Deleted ${response.data.deleted} records`);
      queryClient.invalidateQueries({ queryKey: ['weddings'] });
    } catch (error) {
      alert('Error clearing dates: ' + error.message);
    }
  };

  const handleFormClose = () => {
    setShowWeddingForm(false);
    setShowBlockForm(false);
    setSelectedDate(null);
    setEditingWedding(null);
  };

  if (userLoading || !user) {
    return <div className="py-12 text-center">Loading...</div>;
  }

  if (!venueId) {
    if (user.role === 'admin' && !user.venue_id) {
      return <VenueSelector user={user} onVenueSelected={setVenueId} />;
    }
    return (
      <div className="text-center max-w-md mx-auto py-12">
        <h2 className="text-2xl font-bold mb-4">No Venue Assigned</h2>
        <p className="text-stone-600 mb-4">Your account hasn't been assigned to a venue yet. Please contact your administrator.</p>
        <Button onClick={() => base44.auth.logout()}>Logout</Button>
      </div>
    );
  }

  return (
    <>
      {/* Page actions. The title and venue name live in the shell header now. */}
      <div className="flex flex-wrap items-center justify-end gap-2 mb-6">
        <Button onClick={handleClearDates} variant="outline" className="gap-2 text-red-600 hover:text-red-700">
          🗑️ Clear All Synced Dates
        </Button>
        <Link to={createPageUrl('AdminWeddings')}>
          <Button variant="outline" className="gap-2">
            <List className="w-4 h-4" />
            Weddings List
          </Button>
        </Link>
        <Link to={createPageUrl('Home')}>
          <Button variant="outline" className="gap-2">
            <Home className="w-4 h-4" />
            Chatbot
          </Button>
        </Link>
      </div>

      <div>
        {showWeddingForm ? (
          <WeddingForm
            date={selectedDate}
            wedding={editingWedding}
            venueId={venueId}
            onClose={handleFormClose}
          />
        ) : showBlockForm ? (
          <BlockDateForm
            date={selectedDate}
            venueId={venueId}
            onClose={handleFormClose}
          />
        ) : selectedDate ? (
          <div className="max-w-md mx-auto bg-white border border-stone-200 rounded-2xl p-6 mb-8">
            <h3 className="text-lg font-semibold mb-4">{selectedDate}</h3>
            <p className="text-stone-600 text-sm mb-4">This date is available. What would you like to do?</p>
            <div className="flex gap-2">
              <Button onClick={() => setSelectedDate(null)} variant="outline" className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleBlockDate} variant="outline" className="flex-1">
                Block Date
              </Button>
              <Button onClick={handleBookWedding} className="flex-1 bg-black hover:bg-stone-800">
                Book Wedding
              </Button>
            </div>
          </div>
        ) : null}

        {venueId && (
          <CalendarView
            weddings={weddings}
            blocked={blocked}
            onDateClick={handleDateClick}
            onDeleteWedding={(id) => {
              if (confirm('Delete this wedding booking?')) {
                deleteWeddingMutation.mutate(id);
              }
            }}
          />
        )}

      </div>
    </>
  );
}