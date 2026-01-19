import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, GripVertical, Save, HelpCircle, Play } from 'lucide-react';

export default function FirstLookSettings({ venueId }) {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState({
    is_enabled: true,
    welcome_video_id: '',
    welcome_video_thumbnail: '',
    host_name: '',
    host_title: 'Owner & Head Planner',
    welcome_text: 'let me show you around.',
    video_options: [{ id: 'option1', label: '', video_id: '' }]
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
        welcome_video_id: existingConfig.welcome_video_id || '',
        welcome_video_thumbnail: existingConfig.welcome_video_thumbnail || '',
        host_name: existingConfig.host_name || '',
        host_title: existingConfig.host_title || 'Owner & Head Planner',
        welcome_text: existingConfig.welcome_text || 'let me show you around.',
        video_options: existingConfig.video_options?.length > 0 
          ? existingConfig.video_options 
          : [{ id: 'option1', label: '', video_id: '' }]
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
      video_options: [...prev.video_options, { id: `option${Date.now()}`, label: '', video_id: '' }]
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

  // Extract video ID from full Wistia URL if pasted
  const extractVideoId = (input) => {
    if (!input) return '';
    // If it's already just an ID (no slashes or dots), return as-is
    if (/^[a-z0-9]+$/i.test(input)) return input;
    // Try to extract from URLs like https://idealbrides.wistia.com/medias/d0y9vqposd
    const match = input.match(/wistia\.com\/medias\/([a-z0-9]+)/i);
    if (match) return match[1];
    // Try to extract from embed URLs like https://fast.wistia.net/embed/iframe/d0y9vqposd
    const embedMatch = input.match(/embed\/iframe\/([a-z0-9]+)/i);
    if (embedMatch) return embedMatch[1];
    return input;
  };

  const handleVideoIdChange = (field, value) => {
    const videoId = extractVideoId(value);
    updateConfig(field, videoId);
  };

  const handleOptionVideoIdChange = (index, value) => {
    const videoId = extractVideoId(value);
    updateVideoOption(index, 'video_id', videoId);
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
                <Label>Wistia Video ID</Label>
                <Input
                  placeholder="e.g., d0y9vqposd"
                  value={config.welcome_video_id}
                  onChange={(e) => handleVideoIdChange('welcome_video_id', e.target.value)}
                />
                <p className="text-xs text-stone-500 mt-1">
                  Paste the video ID or full Wistia URL — we'll extract the ID automatically
                </p>
              </div>
              <div>
                <Label>Thumbnail Image URL (fallback)</Label>
                <Input
                  placeholder="https://..."
                  value={config.welcome_video_thumbnail}
                  onChange={(e) => updateConfig('welcome_video_thumbnail', e.target.value)}
                />
              </div>
              
              {/* Preview */}
              {config.welcome_video_id && (
                <div className="mt-4">
                  <Label>Preview</Label>
                  <div className="mt-2 w-32 h-56 bg-stone-900 rounded-xl overflow-hidden">
                    <iframe
                      src={`https://fast.wistia.net/embed/iframe/${config.welcome_video_id}?autoPlay=true&silentAutoPlay=true&muted=true&endVideoBehavior=loop&playbar=false&controlsVisibleOnLoad=false&fitStrategy=cover`}
                      className="w-full h-full"
                      allow="autoplay"
                      frameBorder="0"
                      title="Preview"
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
              <CardDescription>
                Who's greeting visitors in the welcome video?
              </CardDescription>
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
                    <GripVertical className="w-5 h-5 text-stone-400 mt-2 flex-shrink-0" />
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
                        <Label>Wistia Video ID</Label>
                        <Input
                          placeholder="e.g., abc123xyz"
                          value={option.video_id}
                          onChange={(e) => handleOptionVideoIdChange(index, e.target.value)}
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeVideoOption(index)}
                      disabled={config.video_options.length === 1}
                      className="text-stone-400 hover:text-red-500 flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Wistia Help Card */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <HelpCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-blue-900">How to find your Wistia Video ID</p>
                  <ol className="text-sm text-blue-800 mt-2 space-y-1 list-decimal list-inside">
                    <li>Go to your Wistia account and select a video</li>
                    <li>Look at the URL — it will look like: <code className="bg-blue-100 px-1 rounded">wistia.com/medias/<strong>d0y9vqposd</strong></code></li>
                    <li>Copy the ID at the end (the bold part)</li>
                    <li>Paste it above — or paste the full URL and we'll extract it!</li>
                  </ol>
                  <p className="text-xs text-blue-600 mt-3">💡 Tip: Record in portrait mode (1080x1920) for best results in the mobile widget</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={() => saveMutation.mutate(config)} 
          disabled={!hasChanges || saveMutation.isPending} 
          className="bg-black hover:bg-stone-800"
        >
          <Save className="w-4 h-4 mr-2" />
          {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}