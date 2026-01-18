import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Package, MessageSquare, Trash2, Plus, Upload, Calendar } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '../utils';
import TranscriptUpload from '../components/admin/TranscriptUpload';
import GoogleCalendarSync from '../components/admin/GoogleCalendarSync';
import VenueSelector from '../components/admin/VenueSelector';

export default function VenueSettings() {
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

  // Use selectedVenueId if super admin, otherwise use user's venue_id
  const venueId = selectedVenueId || user?.venue_id;

  const { data: venue } = useQuery({
    queryKey: ['venue', venueId],
    queryFn: () => venueId ? base44.entities.Venue.get(venueId) : null,
    enabled: !!venueId
  });

  const { data: packages = [] } = useQuery({
    queryKey: ['packages', venueId],
    queryFn: () => venueId ? base44.entities.VenuePackage.filter({ venue_id: venueId }) : [],
    enabled: !!venueId
  });

  const { data: knowledge = [] } = useQuery({
    queryKey: ['knowledge', venueId],
    queryFn: () => venueId ? base44.entities.VenueKnowledge.filter({ venue_id: venueId }) : [],
    enabled: !!venueId
  });

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!venueId) {
    if (user.role === 'admin' && !user.venue_id) {
      return (
        <div className="min-h-screen bg-white">
          <div className="border-b border-stone-200">
            <div className="max-w-7xl mx-auto px-4 py-4">
              <h1 className="text-2xl font-semibold">Venue Settings</h1>
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
          <p className="text-stone-600 mb-4">You need to be assigned to a venue to access settings.</p>
          <Link to={createPageUrl(user.role === 'admin' ? 'SuperAdmin' : 'Dashboard')}>
            <Button>Go Back</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl('Dashboard')}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold">Venue Settings</h1>
              {venue && <p className="text-sm text-stone-600">{venue.name}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {user.role === 'admin' && !user.venue_id && <VenueSelector user={user} onVenueSelected={setSelectedVenueId} />}
        
        <Tabs defaultValue="packages">
          <TabsList>
            <TabsTrigger value="packages">
              <Package className="w-4 h-4 mr-2" />
              Packages
            </TabsTrigger>
            <TabsTrigger value="calendar">
              <Calendar className="w-4 h-4 mr-2" />
              Google Calendar
            </TabsTrigger>
            <TabsTrigger value="chatbot">
              <MessageSquare className="w-4 h-4 mr-2" />
              Chatbot Training
            </TabsTrigger>
            <TabsTrigger value="transcripts">
              <Upload className="w-4 h-4 mr-2" />
              Upload Transcripts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="packages" className="mt-6">
            <PackagesManager packages={packages} venueId={venueId} />
          </TabsContent>

          <TabsContent value="calendar" className="mt-6">
            <GoogleCalendarSync venueId={venueId} />
          </TabsContent>

          <TabsContent value="chatbot" className="mt-6">
            <ChatbotTraining knowledge={knowledge} venueId={venueId} />
          </TabsContent>

          <TabsContent value="transcripts" className="mt-6">
            <TranscriptUpload venueId={venueId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function PackagesManager({ packages, venueId }) {
  const [showForm, setShowForm] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.VenuePackage.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['packages', venueId] })
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Wedding Packages</h2>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Package
        </Button>
      </div>

      {showForm && (
        <PackageForm
          venueId={venueId}
          package={editingPackage}
          onClose={() => {
            setShowForm(false);
            setEditingPackage(null);
          }}
        />
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {packages.map(pkg => (
          <div key={pkg.id} className="border border-stone-200 rounded-xl p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-lg">{pkg.name}</h3>
                <p className="text-2xl font-bold mt-1">${pkg.price.toLocaleString()}</p>
                <p className="text-sm text-stone-600">Up to {pkg.max_guests} guests</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingPackage(pkg);
                    setShowForm(true);
                  }}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (confirm('Delete this package?')) {
                      deleteMutation.mutate(pkg.id);
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {pkg.includes && pkg.includes.length > 0 && (
              <ul className="space-y-1 text-sm">
                {pkg.includes.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-stone-400">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PackageForm({ venueId, package: pkg, onClose }) {
  const [formData, setFormData] = useState({
    name: pkg?.name || '',
    price: pkg?.price || '',
    max_guests: pkg?.max_guests || '',
    description: pkg?.description || '',
    includes: pkg?.includes || [],
    sort_order: pkg?.sort_order || 0
  });
  const [newInclude, setNewInclude] = useState('');
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: (data) => {
      const dataWithVenue = { ...data, venue_id: venueId };
      if (pkg) {
        return base44.entities.VenuePackage.update(pkg.id, dataWithVenue);
      }
      return base44.entities.VenuePackage.create(dataWithVenue);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages', venueId] });
      onClose();
    }
  });

  return (
    <div className="bg-stone-50 border border-stone-200 rounded-xl p-6 mb-6">
      <h3 className="font-semibold mb-4">{pkg ? 'Edit Package' : 'Add Package'}</h3>
      <div className="space-y-4">
        <Input
          placeholder="Package Name *"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            type="number"
            placeholder="Price *"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
          />
          <Input
            type="number"
            placeholder="Max Guests *"
            value={formData.max_guests}
            onChange={(e) => setFormData({ ...formData, max_guests: Number(e.target.value) })}
          />
        </div>
        <Textarea
          placeholder="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
        />
        <div>
          <label className="block text-sm font-medium mb-2">What's Included</label>
          <div className="flex gap-2 mb-2">
            <Input
              placeholder="Add item..."
              value={newInclude}
              onChange={(e) => setNewInclude(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (newInclude.trim()) {
                    setFormData({ ...formData, includes: [...formData.includes, newInclude.trim()] });
                    setNewInclude('');
                  }
                }
              }}
            />
            <Button
              type="button"
              onClick={() => {
                if (newInclude.trim()) {
                  setFormData({ ...formData, includes: [...formData.includes, newInclude.trim()] });
                  setNewInclude('');
                }
              }}
            >
              Add
            </Button>
          </div>
          <div className="space-y-1">
            {formData.includes.map((item, i) => (
              <div key={i} className="flex items-center justify-between bg-white px-3 py-2 rounded border border-stone-200">
                <span className="text-sm">{item}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setFormData({ ...formData, includes: formData.includes.filter((_, idx) => idx !== i) })}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={() => saveMutation.mutate(formData)} className="flex-1" disabled={!formData.name || !formData.price || !formData.max_guests}>
            Save Package
          </Button>
        </div>
      </div>
    </div>
  );
}

function ChatbotTraining({ knowledge, venueId }) {
  const [showForm, setShowForm] = useState(false);
  const [editingKnowledge, setEditingKnowledge] = useState(null);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.VenueKnowledge.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge', venueId] })
  });

  return (
    <div>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <p className="text-sm text-blue-900">
          Train your chatbot by adding common questions and preferred answers. The chatbot will use this information to provide accurate, venue-specific responses.
        </p>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Training Data</h2>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Q&A
        </Button>
      </div>

      {showForm && (
        <KnowledgeForm
          venueId={venueId}
          knowledge={editingKnowledge}
          onClose={() => {
            setShowForm(false);
            setEditingKnowledge(null);
          }}
        />
      )}

      <div className="space-y-3">
        {knowledge.map(item => (
          <div key={item.id} className="border border-stone-200 rounded-xl p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-2 py-1 bg-stone-100 text-stone-700 rounded">{item.category}</span>
                </div>
                <p className="font-medium mb-2">{item.question}</p>
                <p className="text-sm text-stone-600">{item.answer}</p>
              </div>
              <div className="flex gap-2 ml-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingKnowledge(item);
                    setShowForm(true);
                  }}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (confirm('Delete this Q&A?')) {
                      deleteMutation.mutate(item.id);
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KnowledgeForm({ venueId, knowledge, onClose }) {
  const [formData, setFormData] = useState({
    question: knowledge?.question || '',
    answer: knowledge?.answer || '',
    category: knowledge?.category || 'faq'
  });
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: (data) => {
      const dataWithVenue = { ...data, venue_id: venueId };
      if (knowledge) {
        return base44.entities.VenueKnowledge.update(knowledge.id, dataWithVenue);
      }
      return base44.entities.VenueKnowledge.create(dataWithVenue);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['knowledge']);
      onClose();
    }
  });

  return (
    <div className="bg-stone-50 border border-stone-200 rounded-xl p-6 mb-6">
      <h3 className="font-semibold mb-4">{knowledge ? 'Edit Q&A' : 'Add Q&A'}</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Category</label>
          <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="faq">FAQ</SelectItem>
              <SelectItem value="policy">Policy</SelectItem>
              <SelectItem value="pricing">Pricing</SelectItem>
              <SelectItem value="amenities">Amenities</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Question *</label>
          <Input
            placeholder="e.g., What's your cancellation policy?"
            value={formData.question}
            onChange={(e) => setFormData({ ...formData, question: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Answer *</label>
          <Textarea
            placeholder="How the chatbot should respond..."
            value={formData.answer}
            onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
            rows={4}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={() => saveMutation.mutate(formData)} className="flex-1" disabled={!formData.question || !formData.answer}>
            Save Q&A
          </Button>
        </div>
      </div>
    </div>
  );
}