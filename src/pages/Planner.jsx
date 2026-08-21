import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Trash2, Plus, Upload, AlertCircle, FileText } from 'lucide-react';
import { useVenue } from '@/lib/VenueContext';
import VenueSelector from '@/components/admin/VenueSelector';
import VenueDocumentUpload from '@/components/admin/VenueDocumentUpload';
import TranscriptUpload from '@/components/admin/TranscriptUpload';

export default function Planner() {
  const { user, venueId, setVenueId, userLoading } = useVenue();

  // No is_active filter on purpose — the review queue below has to show
  // drafts, which are exactly the rows that are not yet active.
  const { data: knowledge = [] } = useQuery({
    queryKey: ['knowledge', venueId],
    queryFn: () => venueId ? base44.entities.VenueKnowledge.filter({ venue_id: venueId }) : [],
    enabled: !!venueId
  });

  if (userLoading || !user) {
    return <div className="py-12 text-center text-stone-500">Loading...</div>;
  }

  // Same fallback shape Dashboard uses: an admin with no venue of their own
  // picks one; anyone else is told to get assigned.
  if (!venueId) {
    if (user.role === 'admin' && !user.venue_id) {
      return <VenueSelector user={user} onVenueSelected={setVenueId} />;
    }
    return (
      <div className="py-12 text-center max-w-md mx-auto">
        <h2 className="text-2xl font-bold mb-4">No Venue Assigned</h2>
        <p className="text-stone-600">
          Your account hasn't been assigned to a venue yet. Please contact your administrator.
        </p>
      </div>
    );
  }

  return (
    <Tabs defaultValue="review">
      <TabsList>
        <TabsTrigger value="review">
          <MessageSquare className="w-4 h-4 mr-2" />
          Review &amp; Train
        </TabsTrigger>
        <TabsTrigger value="documents">
          <FileText className="w-4 h-4 mr-2" />
          Upload Documents
        </TabsTrigger>
        <TabsTrigger value="transcripts">
          <Upload className="w-4 h-4 mr-2" />
          Upload Transcripts
        </TabsTrigger>
      </TabsList>

      <TabsContent value="review" className="mt-6">
        <ChatbotTraining knowledge={knowledge} venueId={venueId} />
      </TabsContent>

      <TabsContent value="documents" className="mt-6">
        <VenueDocumentUpload venueId={venueId} />
      </TabsContent>

      <TabsContent value="transcripts" className="mt-6">
        <TranscriptUpload venueId={venueId} />
      </TabsContent>
    </Tabs>
  );
}

function ChatbotTraining({ knowledge, venueId }) {
  const [showForm, setShowForm] = useState(false);
  const [editingKnowledge, setEditingKnowledge] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [reviewFilter, setReviewFilter] = useState('all');
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.VenueKnowledge.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge', venueId] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-active', venueId] });
    }
  });

  const approveMutation = useMutation({
    mutationFn: (id) => base44.entities.VenueKnowledge.update(id, { needs_review: false, is_active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge', venueId] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-active', venueId] });
    }
  });

  const approveAllMutation = useMutation({
    mutationFn: async (items) => {
      for (const item of items) {
        await base44.entities.VenueKnowledge.update(item.id, { needs_review: false, is_active: true });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge', venueId] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-active', venueId] });
    }
  });

  const needsReviewCount = knowledge.filter(k => k.needs_review).length;
  const byCategory = categoryFilter === 'all'
    ? knowledge
    : knowledge.filter(k => k.category === categoryFilter);
  const filteredKnowledge = reviewFilter === 'all'
    ? byCategory
    : reviewFilter === 'needs_review'
      ? byCategory.filter(k => k.needs_review)
      : byCategory.filter(k => !k.needs_review);
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

      <div className="mb-4 flex flex-col sm:flex-row gap-2">
        <Select value={reviewFilter} onValueChange={setReviewFilter}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entries</SelectItem>
            <SelectItem value="needs_review">Awaiting review</SelectItem>
            <SelectItem value="approved">Live in chatbot</SelectItem>
          </SelectContent>
        </Select>
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
                  {item.topic && item.topic !== 'general' && (
                    <span className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded">
                      {item.topic}
                    </span>
                  )}
                  {(!item.topic || item.topic === 'general') && (
                    <span className="text-xs px-2 py-1 bg-stone-50 text-stone-500 rounded" title="Rows without a specific topic are sent to the chatbot on every message rather than only when relevant.">
                      no topic
                    </span>
                  )}
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
      queryClient.invalidateQueries({ queryKey: ['knowledge-active', venueId] });
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