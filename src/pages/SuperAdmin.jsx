import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Users, Mail, UserPlus, Copy, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SuperAdmin() {
  const [user, setUser] = useState(null);
  const [showVenueForm, setShowVenueForm] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedVenueForInvite, setSelectedVenueForInvite] = useState(null);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', role: 'venue_owner' });
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState(null);
  const [copied, setCopied] = useState(false);
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
    queryFn: () => base44.entities.User.list(),
    enabled: !!user && user.role === 'admin'
  });

  const inviteMutation = useMutation({
    mutationFn: async (data) => {
      const result = await base44.functions.invoke('createUserInvite', data);
      if (!result.data?.success) {
        throw new Error(result.data?.error || 'Failed to create invite');
      }
      return result.data;
    },
    onSuccess: (data) => {
      setGeneratedInviteUrl(data.invite_url);
      toast.success('Invitation created successfully!');
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const handleCreateInvite = () => {
    if (!inviteForm.email || !selectedVenueForInvite) {
      toast.error('Please fill in all required fields');
      return;
    }

    inviteMutation.mutate({
      email: inviteForm.email,
      name: inviteForm.name,
      venue_id: selectedVenueForInvite,
      role: inviteForm.role,
      created_by: user?.id
    });
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(generatedInviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link copied to clipboard!');
  };

  const closeInviteDialog = () => {
    setInviteDialogOpen(false);
    setGeneratedInviteUrl(null);
    setInviteForm({ email: '', name: '', role: 'venue_owner' });
    setSelectedVenueForInvite(null);
  };

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
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Users ({users.length})</h2>
              <Button onClick={() => setInviteDialogOpen(true)} size="sm">
                <UserPlus className="w-4 h-4 mr-1" />
                Invite User
              </Button>
            </div>
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

        <Dialog open={inviteDialogOpen} onOpenChange={closeInviteDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Invite User</DialogTitle>
              <DialogDescription>
                Send an invitation to a venue owner or staff member
              </DialogDescription>
            </DialogHeader>

            {!generatedInviteUrl ? (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Email Address *</Label>
                  <Input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="user@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Name (Optional)</Label>
                  <Input
                    type="text"
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Jane Smith"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Venue *</Label>
                  <Select value={selectedVenueForInvite} onValueChange={setSelectedVenueForInvite}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a venue" />
                    </SelectTrigger>
                    <SelectContent>
                      {venues?.map((venue) => (
                        <SelectItem key={venue.id} value={venue.id}>
                          {venue.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Role *</Label>
                  <Select value={inviteForm.role} onValueChange={(v) => setInviteForm(prev => ({ ...prev, role: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="venue_owner">Venue Owner</SelectItem>
                      <SelectItem value="venue_staff">Staff Member</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleCreateInvite} 
                  className="w-full rounded-full bg-black hover:bg-stone-800"
                  disabled={inviteMutation.isPending}
                >
                  {inviteMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Invite...
                    </>
                  ) : (
                    'Create Invitation'
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-green-800 font-medium">Invitation Created!</p>
                </div>

                <div className="space-y-2">
                  <Label>Invitation Link</Label>
                  <div className="flex gap-2">
                    <Input value={generatedInviteUrl} readOnly className="bg-stone-50 text-sm" />
                    <Button onClick={copyToClipboard} variant="outline" className="shrink-0">
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-stone-500">
                    Share this link with {inviteForm.email}. It expires in 7 days.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={closeInviteDialog} variant="outline" className="flex-1 rounded-full">
                    Done
                  </Button>
                  <Button 
                    onClick={() => window.open(`mailto:${inviteForm.email}?subject=You're invited&body=Click here to accept your invitation: ${encodeURIComponent(generatedInviteUrl)}`)}
                    className="flex-1 rounded-full bg-black hover:bg-stone-800"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Send Email
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
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