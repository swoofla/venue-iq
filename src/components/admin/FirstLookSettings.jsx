import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, GripVertical, Save, ExternalLink, Play } from 'lucide-react';

export default function FirstLookSettings({ venueId }) {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState({
    is_enabled: true,
    welcome_video_url: '',
    welcome_video_thumbnail: '',
    host_name: '',
    host_title: 'Owner & Head Planner',
    welcome_text: 'let me show you around.',
    video_options: [{ id: 'option1', label: '', video_url: '' }]
  });
  const [hasChanges, setHasChanges] = useState(false);

  const { data: existingConfig, isLoading } = useQuery({
    queryKey: ['firstLookConfig', venueId],
    queryFn: async () => {
      const configs = await base44.entities.FirstLookConfiguration.filter({ venue_id: venueId });
      return configs[0] || null;
    },
    enabled: !!venueId
  });

  useEffect(() => {
    if (existingConfig) {
      setConfig({
        is_enabled: existingConfig.is_enabled ?? true,
        welcome_video_url: existingConfig.welcome_video_url || '',
        welcome_video_thumbnail: existingConfig.welcome_video_thumbnail || '',
        host_name: existingConfig.host_name || '',
        host_title: existingConfig.host_title || 'Owner & Head Planner',
        welcome_text: existingConfig.welcome_text || 'let me show you around.',
        video_options: existingConfig.video_options?.length > 0 
          ? existingConfig.video_options 
          : [{ id: 'option1', label: '', video_url: '' }]
      });
    }
  }, [existingConfig]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (existingConfig?.id) {
        return base44.entities.FirstLookConfiguration.update(existingConfig.id, data);
      } else {
        return base44.entities.FirstLookConfiguration.create({ ...data, venue_id: venueId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firstLookConfig', venueId] });
      setHasChanges(false);
    }
  });

  const updateConfig = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const updateVideoOption = (index, field, value) => {
    setConfig(prev => ({
      ...prev,
      video_options: prev.video_options.map((opt, i) => i === index ? { ...opt, [field]: value } : opt)
    }));
    setHasChanges(true);
  };

  const addVideoOption = () => {
    setConfig(prev => ({
      ...prev,
      video_options: [...prev.video_options, { id: `option${Date.now()}`, label: '', video_url: '' }]
    }));
    setHasChanges(true);
  };

  const removeVideoOption = (index) => {
    setConfig(prev => ({
      ...prev,
      video_options: prev.video_options.filter((_, i) => i !== index)
    }));
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enable Toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Play className="w-5 h-5" />
                First Look
              </CardTitle>
              <CardDescription>
                Give brides a personal video introduction to your venue and team
              </CardDescription>
            </div>
            <Switch
              checked={config.is_enabled}
              onCheckedChange={(checked) => updateConfig('is_enabled', checked)}
            />
          </div>
        </CardHeader>
      </Card>

      {config.is_enabled && (
        <>
          {/* Welcome Video */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Welcome Video</CardTitle>
              <CardDescription>
                This vertical video autoplays muted when First Look opens. Keep it short (15-20 sec).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Video URL</Label>
                <Input
                  placeholder="https://storage.googleapis.com/msgsndr/..."
                  value={config.welcome_video_url}
                  onChange={(e) => updateConfig('welcome_video_url', e.target.value)}
                />
              </div>
              <div>
                <Label>Thumbnail Image URL (fallback)</Label>
                <Input
                  placeholder="https://..."
                  value={config.welcome_video_thumbnail}
                  onChange={(e) => updateConfig('welcome_video_thumbnail', e.target.value)}
                />
              </div>
              {config.welcome_video_url && (
                <div className="mt-4">
                  <Label>Preview</Label>
                  <div className="mt-2 w-32 h-56 bg-stone-900 rounded-xl overflow-hidden">
                    <video
                      src={config.welcome_video_url}
                      className="w-full h-full object-cover"
                      muted loop autoPlay playsInline
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Host Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Host Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name</Label>
                  <Input
                    placeholder="Nadine"
                    value={config.host_name}
                    onChange={(e) => updateConfig('host_name', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Title</Label>
                  <Input
                    placeholder="Owner & Head Planner"
                    value={config.host_title}
                    onChange={(e) => updateConfig('host_title', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Welcome Text</Label>
                <Input
                  placeholder="let me show you around."
                  value={config.welcome_text}
                  onChange={(e) => updateConfig('welcome_text', e.target.value)}
                />
                <p className="text-xs text-stone-500 mt-1">
                  Shows as: "Hi, I'm {config.host_name || '[Name]'}, {config.host_title || '[Title]'}, {config.welcome_text}"
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Video Options */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Video Menu Options</CardTitle>
                  <CardDescription>Add up to 5 videos visitors can explore</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={addVideoOption} disabled={config.video_options.length >= 5}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {config.video_options.map((option, index) => (
                  <div key={option.id} className="flex items-start gap-3 p-4 bg-stone-50 rounded-xl">
                    <GripVertical className="w-5 h-5 text-stone-400 mt-2" />
                    <div className="flex-1 space-y-3">
                      <div>
                        <Label>Button Label</Label>
                        <Input
                          placeholder="e.g., Meet Your Planners"
                          value={option.label}
                          onChange={(e) => updateVideoOption(index, 'label', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Video URL</Label>
                        <Input
                          placeholder="https://storage.googleapis.com/msgsndr/..."
                          value={option.video_url}
                          onChange={(e) => updateVideoOption(index, 'video_url', e.target.value)}
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeVideoOption(index)}
                      disabled={config.video_options.length === 1}
                      className="text-stone-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Help Card */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <ExternalLink className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-blue-900">How to upload videos to HighLevel</p>
                  <ol className="text-sm text-blue-800 mt-2 space-y-1 list-decimal list-inside">
                    <li>Go to HighLevel → Media Library</li>
                    <li>Upload your vertical video (9:16, under 100MB)</li>
                    <li>Right-click uploaded video → Copy URL</li>
                    <li>Paste URL above</li>
                  </ol>
                  <p className="text-xs text-blue-600 mt-2">💡 Record in portrait mode (1080x1920)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate(config)} disabled={!hasChanges || saveMutation.isPending} className="bg-black hover:bg-stone-800">
          <Save className="w-4 h-4 mr-2" />
          {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}