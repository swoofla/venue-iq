import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Package, MessageSquare, Trash2, Plus, Upload, Calendar, Sparkles, Image as ImageIcon, Play, AlertCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '../utils';
import TranscriptUpload from '../components/admin/TranscriptUpload';
import GoogleCalendarSync from '../components/admin/GoogleCalendarSync';
import FirstLookSettings from '../components/admin/FirstLookSettings';
import VenueSelector from '../components/admin/VenueSelector';
import FeaturedPhotosManager from '../components/admin/FeaturedPhotosManager';

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

  const updateVenueMutation = useMutation({
    mutationFn: (data) => base44.entities.Venue.update(venueId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['venue', venueId] })
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

  const { data: visualizerPhotos = [] } = useQuery({
    queryKey: ['visualizerPhotos', venueId],
    queryFn: () => venueId ? base44.entities.VenueVisualizationPhoto.filter({ venue_id: venueId }) : [],
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

        {venue && (
          <div className="space-y-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="font-semibold text-blue-900 mb-3">Custom Domain</h3>
              <Input
                placeholder="e.g., sugarlakeweddings.com"
                value={venue.domain || ''}
                onChange={(e) => updateVenueMutation.mutate({ domain: e.target.value })}
                className="bg-white"
              />
              <p className="text-sm text-blue-800 mt-2">This domain will be used for quote links and tour pages. Contact support to connect your domain.</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="font-semibold text-blue-900 mb-3">Venue Timezone</h3>
              <select
                value={venue.timezone || 'America/New_York'}
                onChange={(e) => updateVenueMutation.mutate({ timezone: e.target.value })}
                className="w-full px-4 py-3 bg-white border-2 border-stone-200 rounded-xl focus:border-black focus:outline-none"
              >
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Phoenix">Arizona (no DST)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="America/Anchorage">Alaska Time (AKT)</option>
                <option value="Pacific/Honolulu">Hawaii Time (HT)</option>
                <option value="America/Puerto_Rico">Atlantic Time (AT)</option>
              </select>
              <p className="text-sm text-blue-800 mt-2">All tour availability and times will display in this timezone</p>
            </div>
          </div>
        )}
        
        <Tabs defaultValue="packages">
           <TabsList>
             <TabsTrigger value="packages">
               <Package className="w-4 h-4 mr-2" />
               Packages
             </TabsTrigger>
             <TabsTrigger value="featured-photos">
               <ImageIcon className="w-4 h-4 mr-2" />
               Welcome Carousel
             </TabsTrigger>
             <TabsTrigger value="first-look">
               <Play className="w-4 h-4 mr-2" />
               First Look
             </TabsTrigger>
             <TabsTrigger value="visualizer">
               <Sparkles className="w-4 h-4 mr-2" />
               Visualizer Photos
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

           <TabsContent value="featured-photos" className="mt-6">
             <FeaturedPhotosManager venueId={venueId} />
           </TabsContent>

           <TabsContent value="first-look" className="mt-6">
             <FirstLookSettings venueId={venueId} />
           </TabsContent>

           <TabsContent value="visualizer" className="mt-6">
            <VisualizerPhotosManager photos={visualizerPhotos} venueId={venueId} />
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
  const [categoryFilter, setCategoryFilter] = useState('all');
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.VenueKnowledge.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge', venueId] })
  });

  const approveMutation = useMutation({
    mutationFn: (id) => base44.entities.VenueKnowledge.update(id, { needs_review: false, is_active: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge', venueId] })
  });

  const approveAllMutation = useMutation({
    mutationFn: async (items) => {
      for (const item of items) {
        await base44.entities.VenueKnowledge.update(item.id, { needs_review: false, is_active: true });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge', venueId] })
  });

  const needsReviewCount = knowledge.filter(k => k.needs_review).length;
  const filteredKnowledge = categoryFilter === 'all' 
    ? knowledge 
    : knowledge.filter(k => k.category === categoryFilter);
  const filteredNeedsReview = filteredKnowledge.filter(k => k.needs_review);

  const handleApproveAll = () => {
    if (confirm(`Approve ${filteredNeedsReview.length} entries? They will become active in your chatbot.`)) {
      approveAllMutation.mutate(filteredNeedsReview);
    }
  };

  return (
    <div>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <p className="text-sm text-blue-900">
          Train your chatbot by adding common questions and preferred answers. The chatbot will use this information to provide accurate, venue-specific responses.
        </p>
      </div>

      {needsReviewCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-amber-900 font-medium">
              ⚠️ You have {needsReviewCount} AI-extracted {needsReviewCount === 1 ? 'entry' : 'entries'} awaiting review.
            </p>
            <p className="text-xs text-amber-800 mt-1">
              These won't appear in your chatbot until approved.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <h2 className="text-xl font-semibold">Training Data</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          {filteredNeedsReview.length > 0 && (
            <Button 
              variant="outline" 
              onClick={handleApproveAll}
              className="text-green-600 border-green-600 hover:bg-green-50"
            >
              Approve All Visible ({filteredNeedsReview.length})
            </Button>
          )}
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Q&A
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="faq">FAQ</SelectItem>
            <SelectItem value="pricing">Pricing</SelectItem>
            <SelectItem value="pricing_nuance">Pricing Nuance</SelectItem>
            <SelectItem value="capacity">Capacity</SelectItem>
            <SelectItem value="policy">Policy</SelectItem>
            <SelectItem value="amenities">Amenities</SelectItem>
            <SelectItem value="ceremony_spaces">Ceremony Spaces</SelectItem>
            <SelectItem value="lodging">Lodging</SelectItem>
            <SelectItem value="sales_workflow">Sales Workflow</SelectItem>
            <SelectItem value="objection_handling">Objection Handling</SelectItem>
            <SelectItem value="brand_voice">Brand Voice</SelectItem>
            <SelectItem value="vendor_info">Vendor Info</SelectItem>
            <SelectItem value="seasonal">Seasonal</SelectItem>
            <SelectItem value="location_directions">Location Directions</SelectItem>
            <SelectItem value="human_handoff">Human Handoff</SelectItem>
          </SelectContent>
        </Select>
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
        {filteredKnowledge.map(item => (
          <div 
            key={item.id} 
            className={`border border-stone-200 rounded-xl p-4 ${
              item.needs_review ? 'bg-amber-50/50 opacity-90' : ''
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs px-2 py-1 bg-stone-100 text-stone-700 rounded">
                    {item.category}
                  </span>
                  {item.needs_review && (
                    <span className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded font-medium">
                      Awaiting Review
                    </span>
                  )}
                  {item.source === 'transcript' && (
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                      AI-Extracted
                    </span>
                  )}
                  {item.confidence !== null && item.confidence !== undefined && (
                    <span className="text-xs px-2 py-1 bg-stone-50 text-stone-600 rounded">
                      {Math.round(item.confidence * 100)}% confidence
                    </span>
                  )}
                </div>
                <p className="font-medium mb-2">{item.question}</p>
                <p className="text-sm text-stone-600">{item.answer}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 ml-4">
                {item.needs_review && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => approveMutation.mutate(item.id)}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      Approve & Activate
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm('Reject and delete this entry?')) {
                          deleteMutation.mutate(item.id);
                        }
                      }}
                      className="text-red-600 border-red-600 hover:bg-red-50"
                    >
                      Reject
                    </Button>
                  </>
                )}
                {!item.needs_review && (
                  <>
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
                  </>
                )}
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
      queryClient.invalidateQueries({ queryKey: ['knowledge', venueId] });
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

function VisualizerPhotosManager({ photos, venueId }) {
  const [showForm, setShowForm] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState(null);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.VenueVisualizationPhoto.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['visualizerPhotos', venueId] })
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }) => base44.entities.VenueVisualizationPhoto.update(id, { is_active: isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['visualizerPhotos', venueId] })
  });

  const photosByCategory = photos.reduce((acc, photo) => {
    if (!acc[photo.category]) acc[photo.category] = [];
    acc[photo.category].push(photo);
    return acc;
  }, {});

  return (
    <div>
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-rose-600 mt-0.5" />
          <div>
            <p className="text-sm text-rose-900 font-medium mb-1">AI Wedding Visualizer Photos</p>
            <p className="text-sm text-rose-800">
              Upload blank venue photos that couples can transform with their wedding designs using AI. 
              Include detailed descriptions to help the AI add decorations accurately.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Visualizer Photo Library</h2>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Photo
        </Button>
      </div>

      {showForm && (
        <VisualizerPhotoForm
          venueId={venueId}
          photo={editingPhoto}
          onClose={() => {
            setShowForm(false);
            setEditingPhoto(null);
          }}
        />
      )}

      {Object.keys(photosByCategory).length === 0 ? (
        <div className="text-center py-12 bg-stone-50 rounded-xl border-2 border-dashed border-stone-200">
          <ImageIcon className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-600 mb-4">No visualizer photos yet</p>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Photo
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(photosByCategory).map(([category, categoryPhotos]) => (
            <div key={category}>
              <h3 className="text-lg font-semibold capitalize mb-4 flex items-center gap-2">
                {category === 'ceremony' && '💒'} 
                {category === 'reception' && '🎉'} 
                {category === 'cocktail' && '🥂'} 
                {category === 'outdoor' && '🌳'} 
                {category === 'detail' && '✨'}
                {category.replace('_', ' ')}
                <span className="text-sm font-normal text-stone-500">({categoryPhotos.length})</span>
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                {categoryPhotos.map(photo => (
                  <div key={photo.id} className={`border-2 rounded-xl overflow-hidden ${photo.is_active ? 'border-stone-200' : 'border-stone-100 opacity-50'}`}>
                    <div className="relative aspect-[4/3] bg-stone-100">
                      <img src={photo.photo_url} alt={photo.name} className="w-full h-full object-cover" />
                      {!photo.is_active && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="text-white text-sm font-medium">Inactive</span>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold">{photo.name}</h4>
                          {photo.description && <p className="text-sm text-stone-600 mt-1">{photo.description}</p>}
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleActiveMutation.mutate({ id: photo.id, isActive: !photo.is_active })}
                            title={photo.is_active ? 'Hide' : 'Show'}
                          >
                            {photo.is_active ? 'Hide' : 'Show'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingPhoto(photo);
                              setShowForm(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (confirm('Delete this photo?')) {
                                deleteMutation.mutate(photo.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {photo.photo_description && (
                        <div className="mt-3 pt-3 border-t border-stone-100">
                          <p className="text-xs text-stone-500 mb-1">AI Context:</p>
                          <p className="text-xs text-stone-600">{photo.photo_description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VisualizerPhotoForm({ venueId, photo, onClose }) {
  const [formData, setFormData] = useState({
    name: photo?.name || '',
    description: photo?.description || '',
    category: photo?.category || 'ceremony',
    photo_url: photo?.photo_url || '',
    photo_description: photo?.photo_description || '',
    transformation_hints: photo?.transformation_hints || '',
    aspect_ratio: photo?.aspect_ratio || '16:9',
    sort_order: photo?.sort_order || 0
  });
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: (data) => {
      const dataWithVenue = { ...data, venue_id: venueId };
      if (photo) {
        return base44.entities.VenueVisualizationPhoto.update(photo.id, dataWithVenue);
      }
      return base44.entities.VenueVisualizationPhoto.create(dataWithVenue);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visualizerPhotos', venueId] });
      onClose();
    }
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, photo_url: file_url });
    } catch (error) {
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-stone-50 border border-stone-200 rounded-xl p-6 mb-6">
      <h3 className="font-semibold mb-4">{photo ? 'Edit Visualizer Photo' : 'Add Visualizer Photo'}</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Photo Upload *</label>
          {formData.photo_url ? (
            <div className="relative aspect-video rounded-lg overflow-hidden bg-stone-100 mb-2">
              <img src={formData.photo_url} alt="Preview" className="w-full h-full object-cover" />
              <button
                onClick={() => setFormData({ ...formData, photo_url: '' })}
                className="absolute top-2 right-2 bg-black/70 text-white px-3 py-1 rounded text-sm hover:bg-black"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-stone-300 rounded-xl p-8 text-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="photo-upload"
                disabled={uploading}
              />
              <label htmlFor="photo-upload" className="cursor-pointer">
                {uploading ? (
                  <div className="text-stone-600">Uploading...</div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                    <p className="text-sm text-stone-600">Click to upload venue photo</p>
                    <p className="text-xs text-stone-500 mt-1">PNG, JPG up to 10MB</p>
                  </>
                )}
              </label>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Display Name *</label>
          <Input
            placeholder="e.g., Lakeside Ceremony"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Category *</label>
          <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ceremony">💒 Ceremony</SelectItem>
              <SelectItem value="reception">🎉 Reception</SelectItem>
              <SelectItem value="cocktail">🥂 Cocktail Hour</SelectItem>
              <SelectItem value="outdoor">🌳 Outdoor Space</SelectItem>
              <SelectItem value="detail">✨ Detail Shot</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">User Description</label>
          <Input
            placeholder="Brief description shown to couples (optional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">AI Photo Description *</label>
          <Textarea
            placeholder="Detailed description for AI: 'Outdoor ceremony area with wooden arch, lake backdrop, green lawn, mountain views, golden hour lighting'"
            value={formData.photo_description}
            onChange={(e) => setFormData({ ...formData, photo_description: e.target.value })}
            rows={3}
          />
          <p className="text-xs text-stone-500 mt-1">Describe what's in the photo - helps AI understand the space</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Transformation Hints</label>
          <Textarea
            placeholder="What can be added: 'Add floral arrangements to arch, add guest chairs, add aisle runner, add ceremony decor'"
            value={formData.transformation_hints}
            onChange={(e) => setFormData({ ...formData, transformation_hints: e.target.value })}
            rows={2}
          />
          <p className="text-xs text-stone-500 mt-1">Guide the AI on what decorations to add</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Aspect Ratio</label>
            <Select value={formData.aspect_ratio} onValueChange={(value) => setFormData({ ...formData, aspect_ratio: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                <SelectItem value="4:3">4:3 (Standard)</SelectItem>
                <SelectItem value="1:1">1:1 (Square)</SelectItem>
                <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Sort Order</label>
            <Input
              type="number"
              placeholder="0"
              value={formData.sort_order}
              onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button 
            onClick={() => saveMutation.mutate(formData)} 
            className="flex-1" 
            disabled={!formData.name || !formData.photo_url || !formData.photo_description}
          >
            Save Photo
          </Button>
        </div>
      </div>
    </div>
  );
}