import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, Users, Mail } from 'lucide-react';

export default function SuperAdmin() {
  const [user, setUser] = useState(null);
  const [showVenueForm, setShowVenueForm] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: venues = [] } = useQuery({
    queryKey: ['venues'],
    queryFn: () => base44.entities.Venue.list()
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list()
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
          <p className="text-stone-600 mb-4">Admin access required</p>
          <Button onClick={() => base44.auth.logout()}>Logout</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6" />
            <h1 className="text-2xl font-semibold">Super Admin - Venue Management</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Venues */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Venues ({venues.length})</h2>
              <Button onClick={() => setShowVenueForm(true)} size="sm">
                + Add Venue
              </Button>
            </div>

            {showVenueForm && <VenueForm onClose={() => setShowVenueForm(false)} />}

            <div className="space-y-2">
              {venues.map(venue => (
                <div key={venue.id} className="border border-stone-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{venue.name}</h3>
                      <p className="text-sm text-stone-600">{venue.location || 'No location'}</p>
                      <p className="text-xs text-stone-500 mt-1">ID: {venue.id}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedVenue(venue);
                        setShowUserForm(true);
                      }}
                    >
                      <Users className="w-4 h-4 mr-1" />
                      Assign User
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Users */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Users ({users.length})</h2>
            <div className="space-y-2">
              {users.map(u => {
                const userVenue = venues.find(v => v.id === u.venue_id);
                return (
                  <div key={u.id} className="border border-stone-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{u.full_name}</p>
                        <p className="text-sm text-stone-600">{u.email}</p>
                        <p className="text-xs text-stone-500 mt-1">
                          {userVenue ? `Venue: ${userVenue.name}` : 'No venue assigned'}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-stone-100 text-stone-700'}`}>
                        {u.role}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {showUserForm && selectedVenue && (
          <AssignUserForm
            venue={selectedVenue}
            onClose={() => {
              setShowUserForm(false);
              setSelectedVenue(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

function VenueForm({ onClose }) {
  const [formData, setFormData] = useState({ name: '', location: '', phone: '', email: '', website: '', description: '' });
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Venue.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['venues']);
      onClose();
    }
  });

  return (
    <div className="border border-stone-200 rounded-lg p-4 mb-4 bg-stone-50">
      <h3 className="font-semibold mb-3">Add New Venue</h3>
      <div className="space-y-2">
        <Input
          placeholder="Venue Name *"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        <Input
          placeholder="Location"
          value={formData.location}
          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
        />
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={() => createMutation.mutate(formData)} className="flex-1" disabled={!formData.name}>
            Create Venue
          </Button>
        </div>
      </div>
    </div>
  );
}

function AssignUserForm({ venue, onClose }) {
  const [email, setEmail] = useState('');
  const queryClient = useQueryClient();

  const assignMutation = useMutation({
    mutationFn: async () => {
      await base44.users.inviteUser(email, 'user');
      // Note: The invited user will need to have their venue_id set manually after they accept
      alert(`Invitation sent to ${email}. After they sign up, manually update their User record to set venue_id: ${venue.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      onClose();
    }
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-6 max-w-md w-full">
        <h3 className="font-semibold mb-2">Invite User to {venue.name}</h3>
        <p className="text-sm text-stone-600 mb-4">
          Send an invitation email. After they accept, you'll need to manually assign their venue_id.
        </p>
        <Input
          type="email"
          placeholder="user@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4"
        />
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={() => assignMutation.mutate()} className="flex-1" disabled={!email}>
            <Mail className="w-4 h-4 mr-2" />
            Send Invite
          </Button>
        </div>
      </div>
    </div>
  );
}