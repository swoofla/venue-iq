import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Star, StarOff, Trash2, Upload } from 'lucide-react';

export default function FeaturedPhotosManager({ venueId }) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['venuePhotos', venueId],
    queryFn: () => venueId ? base44.entities.VenuePhoto.filter({ venue_id: venueId }) : [],
    enabled: !!venueId
  });

  const updatePhotoMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.VenuePhoto.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['venuePhotos', venueId] })
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (id) => base44.entities.VenuePhoto.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['venuePhotos', venueId] })
  });

  const createPhotoMutation = useMutation({
    mutationFn: (data) => base44.entities.VenuePhoto.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['venuePhotos', venueId] })
  });

  const featuredPhotos = photos
    .filter(p => p.is_featured)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const nonFeaturedPhotos = photos
    .filter(p => !p.is_featured)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(featuredPhotos);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update sort_order for all affected items
    items.forEach((photo, index) => {
      if (photo.sort_order !== index) {
        updatePhotoMutation.mutate({ id: photo.id, data: { sort_order: index } });
      }
    });
  };

  const toggleFeatured = (photo) => {
    if (photo.is_featured) {
      // Unfeaturing - just set to false
      updatePhotoMutation.mutate({ 
        id: photo.id, 
        data: { is_featured: false } 
      });
    } else {
      // Featuring - set to true and give it the next sort order
      const maxSort = Math.max(...featuredPhotos.map(p => p.sort_order || 0), -1);
      updatePhotoMutation.mutate({ 
        id: photo.id, 
        data: { is_featured: true, sort_order: maxSort + 1 } 
      });
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const maxSort = Math.max(...featuredPhotos.map(p => p.sort_order || 0), -1);
      
      await createPhotoMutation.mutateAsync({
        venue_id: venueId,
        image_url: file_url,
        is_featured: true,
        sort_order: maxSort + 1,
        category: 'grounds',
        caption: 'Venue photo'
      });
    } catch (error) {
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading photos...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200 p-4">
        <p className="text-sm text-blue-900">
          These featured photos appear in the welcome carousel when visitors first open the chatbot. 
          Drag and drop to reorder them. The first 5 featured photos will be shown.
        </p>
      </Card>

      {/* Featured Photos - Drag and Drop */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Featured Photos ({featuredPhotos.length})</h3>
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
              id="photo-upload"
              disabled={uploading}
            />
            <label htmlFor="photo-upload">
              <Button variant="outline" disabled={uploading} asChild>
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Add Photo'}
                </span>
              </Button>
            </label>
          </div>
        </div>

        {featuredPhotos.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <Star className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-600 mb-4">No featured photos yet</p>
            <p className="text-sm text-stone-500 mb-4">Upload photos or mark existing ones as featured</p>
          </Card>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="featured-photos">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                  {featuredPhotos.map((photo, index) => (
                    <Draggable key={photo.id} draggableId={photo.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`bg-white border-2 rounded-xl p-4 flex items-center gap-4 ${
                            snapshot.isDragging ? 'border-black shadow-lg' : 'border-stone-200'
                          }`}
                        >
                          <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                            <GripVertical className="w-5 h-5 text-stone-400" />
                          </div>
                          
                          <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0">
                            <img 
                              src={photo.image_url} 
                              alt={photo.caption || 'Venue photo'} 
                              className="w-full h-full object-cover"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm mb-1 truncate">
                              {photo.caption || 'Untitled'}
                            </p>
                            <p className="text-xs text-stone-500 capitalize">
                              {photo.category?.replace('_', ' ')}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-stone-500 mr-2">#{index + 1}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleFeatured(photo)}
                              title="Remove from featured"
                            >
                              <StarOff className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (confirm('Delete this photo?')) {
                                  deletePhotoMutation.mutate(photo.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>

      {/* Other Photos */}
      {nonFeaturedPhotos.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Other Photos ({nonFeaturedPhotos.length})</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {nonFeaturedPhotos.map((photo) => (
              <div key={photo.id} className="relative group">
                <div className="relative aspect-square rounded-lg overflow-hidden bg-stone-100">
                  <img 
                    src={photo.image_url} 
                    alt={photo.caption || 'Venue photo'} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      size="sm"
                      onClick={() => toggleFeatured(photo)}
                      className="bg-white text-black hover:bg-stone-100"
                    >
                      <Star className="w-4 h-4 mr-1" />
                      Feature
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-stone-600 mt-2 truncate">{photo.caption || 'Untitled'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}