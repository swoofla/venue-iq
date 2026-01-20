import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Loader2, Edit, Upload, Save, X } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = [
  { key: 'vibe', label: 'Vibe' },
  { key: 'density', label: 'Density' },
  { key: 'colors', label: 'Colors' },
  { key: 'season', label: 'Season' },
];

export default function AdminVisualizerSettings() {
  const [activeTab, setActiveTab] = useState('vibe');
  const [editingImage, setEditingImage] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: heroImages = [], isLoading } = useQuery({
    queryKey: ['visualizerHeroImages'],
    queryFn: async () => {
      const images = await base44.entities.VisualizerHeroImage.list();
      return images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    },
  });

  const updateImageMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.VisualizerHeroImage.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visualizerHeroImages'] });
      setIsDialogOpen(false);
      setEditingImage(null);
      toast.success('Image updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update image: ' + error.message);
    },
  });

  const handleEdit = (image) => {
    setEditingImage({ ...image });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!editingImage?.id) return;
    updateImageMutation.mutate({
      id: editingImage.id,
      data: {
        label: editingImage.label,
        description: editingImage.description,
        prompt: editingImage.prompt,
        image_url: editingImage.image_url,
        colors: editingImage.colors,
        is_active: editingImage.is_active,
      },
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setEditingImage(prev => ({ ...prev, image_url: file_url }));
      toast.success('Image uploaded');
    } catch (error) {
      toast.error('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleColorChange = (index, value) => {
    const newColors = [...(editingImage.colors || [])];
    newColors[index] = value;
    setEditingImage(prev => ({ ...prev, colors: newColors }));
  };

  const addColor = () => {
    setEditingImage(prev => ({
      ...prev,
      colors: [...(prev.colors || []), '#FFFFFF'],
    }));
  };

  const removeColor = (index) => {
    setEditingImage(prev => ({
      ...prev,
      colors: prev.colors.filter((_, i) => i !== index),
    }));
  };

  // Check if user is admin
  if (isLoadingUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-stone-900 mb-2">Access Denied</h1>
          <p className="text-stone-600">This page is only accessible to super admins.</p>
        </div>
      </div>
    );
  }

  const imagesByCategory = heroImages.reduce((acc, img) => {
    if (!acc[img.category]) acc[img.category] = [];
    acc[img.category].push(img);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-stone-900 mb-2">Visualizer Settings</h1>
          <p className="text-stone-600">Manage hero images and options for the AI Wedding Visualizer</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            {CATEGORIES.map((cat) => (
              <TabsTrigger key={cat.key} value={cat.key}>
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {CATEGORIES.map((cat) => (
            <TabsContent key={cat.key} value={cat.key}>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {imagesByCategory[cat.key]?.map((image) => (
                    <Card key={image.id} className="overflow-hidden">
                      <div className="aspect-[16/9] relative bg-stone-100">
                        <img
                          src={image.image_url}
                          alt={image.label}
                          className="w-full h-full object-cover"
                        />
                        {!image.is_active && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="text-white font-medium">Inactive</span>
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-stone-900 mb-1">{image.label}</h3>
                        <p className="text-sm text-stone-600 mb-3">{image.description}</p>
                        {image.colors && image.colors.length > 0 && (
                          <div className="flex -space-x-1 mb-3">
                            {image.colors.map((color, i) => (
                              <div
                                key={i}
                                className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        )}
                        <Button
                          onClick={() => handleEdit(image)}
                          variant="outline"
                          className="w-full"
                          size="sm"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit: {editingImage?.label}</DialogTitle>
            </DialogHeader>

            {editingImage && (
              <div className="space-y-6 py-4">
                {/* Hero Image */}
                <div>
                  <Label>Hero Image</Label>
                  <div className="mt-2 flex items-start gap-4">
                    <div className="w-48 h-32 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0">
                      <img
                        src={editingImage.image_url}
                        alt="Current"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="image-upload"
                        disabled={uploading}
                      />
                      <label htmlFor="image-upload">
                        <Button variant="outline" disabled={uploading} asChild>
                          <span>
                            {uploading ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4 mr-2" />
                            )}
                            Change Image
                          </span>
                        </Button>
                      </label>
                      <p className="text-xs text-stone-500 mt-2">
                        Recommended: 800x450px (16:9)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Label */}
                <div>
                  <Label>Label</Label>
                  <Input
                    value={editingImage.label}
                    onChange={(e) => setEditingImage(prev => ({ ...prev, label: e.target.value }))}
                    placeholder="e.g., Romantic & Garden-Inspired"
                    className="mt-1"
                  />
                </div>

                {/* Description */}
                <div>
                  <Label>Description</Label>
                  <Input
                    value={editingImage.description}
                    onChange={(e) => setEditingImage(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="e.g., Soft, lush, floral-forward, dreamy"
                    className="mt-1"
                  />
                </div>

                {/* AI Prompt */}
                <div>
                  <Label>AI Prompt</Label>
                  <Textarea
                    value={editingImage.prompt}
                    onChange={(e) => setEditingImage(prev => ({ ...prev, prompt: e.target.value }))}
                    placeholder="The AI prompt fragment for this option..."
                    className="mt-1 h-32"
                  />
                </div>

                {/* Colors (only for color category) */}
                {editingImage.category === 'colors' && (
                  <div>
                    <Label>Color Palette</Label>
                    <div className="mt-2 space-y-2">
                      {editingImage.colors?.map((color, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            type="color"
                            value={color}
                            onChange={(e) => handleColorChange(i, e.target.value)}
                            className="w-12 h-10 rounded border border-stone-200"
                          />
                          <Input
                            value={color}
                            onChange={(e) => handleColorChange(i, e.target.value)}
                            placeholder="#FFFFFF"
                            className="flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeColor(i)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" onClick={addColor} size="sm">
                        Add Color
                      </Button>
                    </div>
                  </div>
                )}

                {/* Active Toggle */}
                <div className="flex items-center justify-between">
                  <Label>Active</Label>
                  <Switch
                    checked={editingImage.is_active}
                    onCheckedChange={(checked) => setEditingImage(prev => ({ ...prev, is_active: checked }))}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={updateImageMutation.isPending}>
                {updateImageMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}