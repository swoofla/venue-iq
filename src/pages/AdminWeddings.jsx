import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Calendar, Home, CheckCircle, Circle, Pencil, Trash2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { format } from 'date-fns';
import WeddingForm from '../components/admin/WeddingForm';
import VenueSelector from '../components/admin/VenueSelector';

export default function AdminWeddings() {
  const [showForm, setShowForm] = useState(false);
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

  const { data: weddings = [] } = useQuery({
    queryKey: ['weddings', venueId],
    queryFn: () => venueId ? base44.asServiceRole.entities.BookedWeddingDate.filter({ venue_id: venueId }, '-date') : [],
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

  const upcomingWeddings = weddings.filter(w => new Date(w.date) >= new Date());
  const pastWeddings = weddings.filter(w => new Date(w.date) < new Date());

  const packageNames = {
    intimate_garden: 'Intimate Garden',
    classic_elegance: 'Classic Elegance',
    grand_estate: 'Grand Estate'
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
              <h1 className="text-2xl font-semibold">Weddings List</h1>
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
              <Calendar className="w-6 h-6" />
              <div>
                <h1 className="text-2xl font-semibold">Weddings List</h1>
                {venue && <p className="text-sm text-stone-600">{venue.name}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              <Link to={createPageUrl('AdminCalendar')}>
                <Button variant="outline" className="gap-2">
                  <Calendar className="w-4 h-4" />
                  Calendar View
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
        {showForm && (
          <div className="mb-8">
            <WeddingForm
              wedding={editingWedding}
              onClose={() => {
                setShowForm(false);
                setEditingWedding(null);
              }}
            />
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Upcoming Weddings ({upcomingWeddings.length})</h2>
          <Button onClick={() => setShowForm(true)} className="bg-black hover:bg-stone-800">
            + Add Wedding
          </Button>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden mb-8">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-stone-900">Date</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-stone-900">Couple</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-stone-900">Package</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-stone-900">Guests</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-stone-900">Deposit</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-stone-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {upcomingWeddings.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-stone-500">
                    No upcoming weddings scheduled
                  </td>
                </tr>
              ) : (
                upcomingWeddings.map((wedding) => (
                  <tr key={wedding.id} className="border-b border-stone-100 hover:bg-stone-50">
                    <td className="px-6 py-4 font-medium">
                      {format(new Date(wedding.date + 'T00:00:00'), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4">{wedding.couple_name || '-'}</td>
                    <td className="px-6 py-4">{packageNames[wedding.package] || '-'}</td>
                    <td className="px-6 py-4">{wedding.guest_count || '-'}</td>
                    <td className="px-6 py-4">
                      {wedding.deposit_paid ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <Circle className="w-5 h-5 text-stone-300" />
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingWedding(wedding);
                            setShowForm(true);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm('Delete this wedding booking?')) {
                              deleteWeddingMutation.mutate(wedding.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pastWeddings.length > 0 && (
          <>
            <h2 className="text-xl font-semibold mb-6">Past Weddings ({pastWeddings.length})</h2>
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-medium text-stone-900">Date</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-stone-900">Couple</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-stone-900">Package</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-stone-900">Guests</th>
                  </tr>
                </thead>
                <tbody>
                  {pastWeddings.map((wedding) => (
                    <tr key={wedding.id} className="border-b border-stone-100">
                      <td className="px-6 py-4 font-medium text-stone-500">
                        {format(new Date(wedding.date + 'T00:00:00'), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 text-stone-500">{wedding.couple_name || '-'}</td>
                      <td className="px-6 py-4 text-stone-500">{packageNames[wedding.package] || '-'}</td>
                      <td className="px-6 py-4 text-stone-500">{wedding.guest_count || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}