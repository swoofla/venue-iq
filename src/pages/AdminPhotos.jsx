import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '../utils';
import VenueSelector from '@/components/admin/VenueSelector';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Star, 
  StarOff, 
  Image as ImageIcon,
  X,
  Save,
  Eye,
  EyeOff
} from 'lucide-react';

const CATEGORIES = [
  { id: 'ceremony', name: 'Ceremony Spaces' },
  { id: 'reception', name: 'Reception Hall' },
  { id: 'grounds', name: 'Venue Grounds' },
  { id: 'details', name: 'Wedding Details' },
  { id: 'bridal_suite', name: 'Bridal Suite' },
  { id: 'exterior', name: 'Exterior Views' },
];

export default function AdminPhotos() {
  const [user, setUser] = useState(null);
  const [selectedVenueId, setSelectedVenueId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('ceremony');
  const [isAddingPhoto, setIsAddingPhoto] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [newPhoto, setNewPhoto] = useState({
    image_url: '',
    caption: '',
    alt_text: '',
    category: 'ceremony',
    is_featured: false
  });
  
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  // Get current user's venue
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

  // Fetch photos
  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['adminVenuePhotos', venueId],
    queryFn: () => base44.entities.VenuePhoto.filter({ venue_id: venueId }),
    enabled: !!venueId
  });

  // Filter photos by selected category
  const categoryPhotos = photos
    .filter(p => p.category === selectedCategory)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  // Create photo mutation
  const createPhoto = useMutation({
    mutationFn: (photoData) => base44.entities.VenuePhoto.create({
      ...photoData,
      venue_id: venueId,
      sort_order: categoryPhotos.length
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminVenuePhotos', venueId] });
      setIsAddingPhoto(false);
      setNewPhoto({
        image_url: '',
        caption: '',
        alt_text: '',
        category: selectedCategory,
        is_featured: false
      });
    }
  });

  // Update photo mutation
  const updatePhoto = useMutation({
    mutationFn: ({ id, data }) => base44.entities.VenuePhoto.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminVenuePhotos', venueId] });
      setEditingPhoto(null);
    }
  });

  // Delete photo mutation
  const deletePhoto = useMutation({
    mutationFn: (id) => base44.entities.VenuePhoto.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminVenuePhotos', venueId] });
    }
  });

  // Toggle featured status
  const toggleFeatured = (photo) => {
    updatePhoto.mutate({
      id: photo.id,
      data: { is_featured: !photo.is_featured }
    });
  };

  // Toggle active status
  const toggleActive = (photo) => {
    updatePhoto.mutate({
      id: photo.id,
      data: { is_active: !photo.is_active }
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      setNewPhoto({ ...newPhoto, image_url: result.file_url });
    } catch (error) {
      alert('Failed to upload image: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveNewPhoto = () => {
    if (!newPhoto.image_url) return;
    createPhoto.mutate({
      ...newPhoto,
      category: selectedCategory
    });
  };

  const handleSaveEdit = () => {
    if (!editingPhoto) return;
    updatePhoto.mutate({
      id: editingPhoto.id,
      data: {
        image_url: editingPhoto.image_url,
        caption: editingPhoto.caption,
        alt_text: editingPhoto.alt_text,
        is_featured: editingPhoto.is_featured
      }
    });
  };

  // Count photos per category
  const getCategoryCount = (categoryId) => {
    return photos.filter(p => p.category === categoryId).length;
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
              <h1 className="text-2xl font-semibold">Photo Gallery</h1>
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
            <div>
              <h1 className="text-2xl font-semibold">Photo Gallery</h1>
              <p className="text-sm text-stone-600 mt-1">Manage venue photos displayed in the chatbot</p>
            </div>
            <div className="flex gap-2">
              <Link to={createPageUrl('Dashboard') + (selectedVenueId ? `?venue_id=${selectedVenueId}` : '')}>
                <Button variant="outline">Dashboard</Button>
              </Link>
              <Button onClick={() => base44.auth.logout()} variant="outline">
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <Button
            onClick={() => setIsAddingPhoto(true)}
            className="bg-black hover:bg-stone-800"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Photo
          </Button>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-black text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {cat.name}
              <span className="ml-2 px-2 py-0.5 rounded-full bg-white/20 text-xs">
                {getCategoryCount(cat.id)}
              </span>
            </button>
          ))}
        </div>

        {/* Add Photo Form */}
        {isAddingPhoto && (
          <div className="bg-white rounded-xl border border-stone-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-stone-900">Add New Photo</h3>
              <button onClick={() => setIsAddingPhoto(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Upload Image *
                </label>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="hidden"
                      />
                      <div className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                        uploading ? 'border-stone-300 bg-stone-50' : 'border-stone-300 hover:border-stone-400 hover:bg-stone-50'
                      }`}>
                        {uploading ? (
                          <div className="flex items-center justify-center gap-2 text-stone-600">
                            <div className="w-4 h-4 border-2 border-stone-600 border-t-transparent rounded-full animate-spin"></div>
                            Uploading...
                          </div>
                        ) : newPhoto.image_url ? (
                          <div className="text-green-600 font-medium">✓ Image uploaded</div>
                        ) : (
                          <div className="text-stone-600">
                            <ImageIcon className="w-8 h-8 mx-auto mb-2 text-stone-400" />
                            Click to select an image
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                  {newPhoto.image_url && (
                    <Input
                      value={newPhoto.image_url}
                      onChange={(e) => setNewPhoto({ ...newPhoto, image_url: e.target.value })}
                      placeholder="Or paste image URL"
                      className="text-sm"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Caption
                </label>
                <Input
                  value={newPhoto.caption}
                  onChange={(e) => setNewPhoto({ ...newPhoto, caption: e.target.value })}
                  placeholder="Garden ceremony site at sunset"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Alt Text (for accessibility)
                </label>
                <Input
                  value={newPhoto.alt_text}
                  onChange={(e) => setNewPhoto({ ...newPhoto, alt_text: e.target.value })}
                  placeholder="Describe the image for screen readers"
                />
              </div>
              
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPhoto.is_featured}
                    onChange={(e) => setNewPhoto({ ...newPhoto, is_featured: e.target.checked })}
                    className="rounded border-stone-300"
                  />
                  <span className="text-sm text-stone-700">Featured (category thumbnail)</span>
                </label>
              </div>
            </div>

            {/* Preview */}
            {newPhoto.image_url && (
              <div className="mt-4">
                <p className="text-sm font-medium text-stone-700 mb-2">Preview:</p>
                <img
                  src={newPhoto.image_url}
                  alt="Preview"
                  className="h-40 object-cover rounded-lg"
                  onError={(e) => e.target.style.display = 'none'}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsAddingPhoto(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNewPhoto} disabled={!newPhoto.image_url || uploading}>
              <Save className="w-4 h-4 mr-2" />
              Save Photo
            </Button>
            </div>
          </div>
        )}

        {/* Photos Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-stone-500">Loading photos...</div>
        ) : categoryPhotos.length === 0 ? (
          <div className="text-center py-12 bg-stone-50 rounded-xl">
            <ImageIcon className="w-12 h-12 text-stone-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-stone-900 mb-2">No photos yet</h3>
            <p className="text-stone-600 mb-4">Add your first photo to this category</p>
            <Button onClick={() => setIsAddingPhoto(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Photo
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categoryPhotos.map(photo => (
              <div
                key={photo.id}
                className={`relative group bg-white rounded-xl overflow-hidden border ${
                  photo.is_active === false ? 'opacity-50 border-stone-300' : 'border-stone-200'
                }`}
              >
                <div className="aspect-[4/3] relative">
                  <img
                    src={photo.image_url}
                    alt={photo.alt_text || photo.caption || 'Venue photo'}
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Featured badge */}
                  {photo.is_featured && (
                    <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      Featured
                    </div>
                  )}
                  
                  {/* Inactive badge */}
                  {photo.is_active === false && (
                    <div className="absolute top-2 right-2 bg-stone-800 text-white px-2 py-1 rounded-full text-xs font-medium">
                      Hidden
                    </div>
                  )}
                  
                  {/* Hover actions */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => setEditingPhoto(photo)}
                      className="p-2 bg-white rounded-full text-stone-700 hover:bg-stone-100"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleFeatured(photo)}
                      className="p-2 bg-white rounded-full text-stone-700 hover:bg-stone-100"
                      title={photo.is_featured ? 'Remove featured' : 'Set as featured'}
                    >
                      {photo.is_featured ? <StarOff className="w-4 h-4" /> : <Star className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => toggleActive(photo)}
                      className="p-2 bg-white rounded-full text-stone-700 hover:bg-stone-100"
                      title={photo.is_active !== false ? 'Hide' : 'Show'}
                    >
                      {photo.is_active !== false ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this photo?')) {
                          deletePhoto.mutate(photo.id);
                        }
                      }}
                      className="p-2 bg-red-500 rounded-full text-white hover:bg-red-600"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Caption */}
                {photo.caption && (
                  <div className="p-3">
                    <p className="text-sm text-stone-700 line-clamp-2">{photo.caption}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Edit Photo Modal */}
        {editingPhoto && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-stone-900">Edit Photo</h3>
                <button onClick={() => setEditingPhoto(null)} className="text-stone-400 hover:text-stone-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <img
                    src={editingPhoto.image_url}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded-lg mb-4"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Image URL
                  </label>
                  <Input
                    value={editingPhoto.image_url}
                    onChange={(e) => setEditingPhoto({ ...editingPhoto, image_url: e.target.value })}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Caption
                  </label>
                  <Input
                    value={editingPhoto.caption || ''}
                    onChange={(e) => setEditingPhoto({ ...editingPhoto, caption: e.target.value })}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Alt Text
                  </label>
                  <Input
                    value={editingPhoto.alt_text || ''}
                    onChange={(e) => setEditingPhoto({ ...editingPhoto, alt_text: e.target.value })}
                  />
                </div>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingPhoto.is_featured}
                    onChange={(e) => setEditingPhoto({ ...editingPhoto, is_featured: e.target.checked })}
                    className="rounded border-stone-300"
                  />
                  <span className="text-sm text-stone-700">Featured (category thumbnail)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setEditingPhoto(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}