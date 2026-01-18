import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Home, List } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '../utils';
import CalendarView from '../components/admin/CalendarView';
import WeddingForm from '../components/admin/WeddingForm';
import BlockDateForm from '../components/admin/BlockDateForm';
import VenueSelector from '../components/admin/VenueSelector';

export default function AdminCalendar() {
  const [selectedDate, setSelectedDate] = useState(null);
  const [showWeddingForm, setShowWeddingForm] = useState(false);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [editingWedding, setEditingWedding] = useState(null);
  const [user, setUser] = useState(null);
  const [selectedVenueId, setSelectedVenueId] = useState(null);
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      const paramVenueId = searchParams.get('venue_id');
      if (paramVenueId) {
        setSelectedVenueId(paramVenueId);
      }
    });
  }, [searchParams]);

  const venueId = selectedVenueId || user?.venue_id;

  // DEBUG - remove after fixing
  React.useEffect(() => {
    console.log('DEBUG AdminCalendar:', {
      user: user,
      userVenueId: user?.venue_id,
      selectedVenueId: selectedVenueId,
      finalVenueId: venueId,
      queryEnabled: !!venueId
    });
  }, [user, selectedVenueId, venueId]);

  const { data: weddings = [] } = useQuery({
    queryKey: ['weddings', venueId],
    queryFn: () => venueId ? base44.asServiceRole.entities.BookedWeddingDate.filter({ venue_id: venueId }) : [],
    enabled: !!venueId
  });

  const { data: blocked = [] } = useQuery({
    queryKey: ['blocked', venueId],
    queryFn: () => venueId ? base44.asServiceRole.entities.BlockedDate.filter({ venue_id: venueId }) : [],
    enabled: !!venueId
  });

  const { data: venue } = useQuery({
    queryKey: ['venue', venueId],
    queryFn: () => venueId ? base44.asServiceRole.entities.Venue.get(venueId) : null,
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

  const handleFormClose = () => {
    setShowWeddingForm(false);
    setShowBlockForm(false);
    setSelectedDate(null);
    setEditingWedding(null);
  };

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!venueId) {
    if (user.role === 'admin' && !user.venue_id) {
      return (
        <div className="min-h-screen bg-white">
          <div className="border-b border-stone-200">
            <div className="max-w-7xl mx-auto px-4 py-4">
              <h1 className="text-2xl font-semibold">Wedding Calendar</h1>
            </div>
          </div>
          <div className="max-w-7xl mx-auto px-4 py-8">
            <VenueSelector user={user} onVenueSelected={setSelectedVenueId} />
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">No Venue Assigned</h2>
          <p className="text-stone-600 mb-4">Your account hasn't been assigned to a venue yet. Please contact your administrator.</p>
          <Button onClick={() => base44.auth.logout()}>Logout</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CalendarIcon className="w-6 h-6" />
              <div>
                <h1 className="text-2xl font-semibold">Wedding Calendar</h1>
                {venue && <p className="text-sm text-stone-600">{venue.name}</p>}
              </div>
            </div>
            <div className="flex gap-2">
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
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {showWeddingForm ? (
          <WeddingForm
            date={selectedDate}
            wedding={editingWedding}
            onClose={handleFormClose}
          />
        ) : showBlockForm ? (
          <BlockDateForm
            date={selectedDate}
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
    </div>
  );
}