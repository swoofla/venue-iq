import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Loader2, CheckCircle2 } from 'lucide-react';

export default function TranscriptUpload({ venueId }) {
  const [transcript, setTranscript] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const queryClient = useQueryClient();

  const processMutation = useMutation({
    mutationFn: async (text) => {
      setProcessing(true);
      setResult(null);
      
      // Use AI to extract Q&A pairs from transcript
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this conversation transcript between a wedding venue and a potential client. Extract:
1. Common questions asked by the client
2. Answers provided by the venue
3. Important venue policies, pricing details, or amenities mentioned

Format as a JSON array of Q&A pairs with categories.

Transcript:
${text}`,
        response_json_schema: {
          type: "object",
          properties: {
            qa_pairs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  answer: { type: "string" },
                  category: { 
                    type: "string",
                    enum: ["faq", "policy", "pricing", "amenities", "other"]
                  }
                }
              }
            }
          }
        }
      });

      // Save extracted Q&A pairs to VenueKnowledge
      const pairs = response.qa_pairs || [];
      const created = [];
      
      for (const pair of pairs) {
        const knowledge = await base44.entities.VenueKnowledge.create({
          venue_id: venueId,
          question: pair.question,
          answer: pair.answer,
          category: pair.category || 'faq',
          is_active: true
        });
        created.push(knowledge);
      }

      return { count: created.length };
    },
    onSuccess: (data) => {
      setProcessing(false);
      setResult({ success: true, count: data.count });
      setTranscript('');
      queryClient.invalidateQueries(['knowledge']);
    },
    onError: (error) => {
      setProcessing(false);
      setResult({ success: false, error: error.message });
    }
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Upload Conversation Transcript</h3>
        <p className="text-sm text-stone-600 mb-4">
          Paste a conversation transcript with a bride or couple. AI will automatically extract questions, 
          answers, and important information to train your chatbot.
        </p>
      </div>

      <Textarea
        placeholder="Paste conversation transcript here...

Example:
Bride: What's included in the Classic Elegance package?
Venue: Our Classic Elegance package includes ceremony setup, 6-hour venue rental, tables & chairs for up to 150 guests, basic lighting, and a dedicated event coordinator..."
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        className="min-h-[300px] font-mono text-sm"
        disabled={processing}
      />

      <div className="flex items-center justify-between">
        <Button
          onClick={() => processMutation.mutate(transcript)}
          disabled={!transcript.trim() || processing}
          className="gap-2"
        >
          {processing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing with AI...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Process Transcript
            </>
          )}
        </Button>

        {result && (
          <div className={`flex items-center gap-2 text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
            {result.success ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Extracted {result.count} Q&A pairs
              </>
            ) : (
              <>Error: {result.error}</>
            )}
          </div>
        )}
      </div>

      {processing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <p className="font-medium mb-1">AI is analyzing your transcript...</p>
          <p className="text-xs text-blue-600">
            This may take 10-30 seconds depending on transcript length
          </p>
        </div>
      )}
    </div>
  );
}