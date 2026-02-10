import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Upload, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Brain, 
  MessageSquare, 
  DollarSign, 
  Users, 
  Shield, 
  Heart,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const PASSES = [
  { id: 'pricing',     label: 'Pricing Intelligence',  icon: DollarSign,    color: 'text-green-600' },
  { id: 'capacity',    label: 'Capacity & Objections', icon: Users,         color: 'text-blue-600' },
  { id: 'policies',    label: 'Policies & Workflow',   icon: Shield,        color: 'text-purple-600' },
  { id: 'amenities',   label: 'Venue Details',         icon: MessageSquare, color: 'text-amber-600' },
  { id: 'brand_voice', label: 'Brand Voice',           icon: Heart,         color: 'text-pink-600' },
  { id: 'handoff',     label: 'Human Handoff Rules',   icon: AlertCircle,   color: 'text-red-600' },
];

function chunkTranscript(text, maxChars = 12000) {
  const lines = text.split('\n');
  const chunks = [];
  let current = [];
  let len = 0;
  for (const line of lines) {
    if (len + line.length > maxChars && current.length > 0) {
      chunks.push(current.join('\n'));
      current = [];
      len = 0;
    }
    current.push(line);
    len += line.length + 1;
  }
  if (current.length > 0) chunks.push(current.join('\n'));
  return chunks;
}

export default function TranscriptUpload({ venueId }) {
  const [transcript, setTranscript] = useState('');
  const [processing, setProcessing] = useState(false);
  const [currentPass, setCurrentPass] = useState(null);
  const [currentChunk, setCurrentChunk] = useState(null);
  const [totalChunks, setTotalChunks] = useState(0);
  const [completedPasses, setCompletedPasses] = useState([]);
  const [results, setResults] = useState(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const queryClient = useQueryClient();

  const lineCount = transcript.split('\n').length;
  const estimatedChunks = Math.ceil(transcript.length / 12000);
  const estimatedTime = estimatedChunks * 6 * 3; // rough estimate: 3s per chunk per pass

  const handleProcess = async () => {
    setProcessing(true);
    setCompletedPasses([]);
    setResults(null);

    const chunks = chunkTranscript(transcript);
    setTotalChunks(chunks.length);

    const passResults = {};

    try {
      for (const pass of PASSES) {
        setCurrentPass(pass.id);
        let passTotal = { saved: 0, extracted: 0, skipped: 0 };

        for (let i = 0; i < chunks.length; i++) {
          setCurrentChunk(i + 1);

          const response = await base44.functions.invoke('processTranscriptIntelligence', {
            venue_id: venueId,
            transcript: chunks[i],
            pass: pass.id
          });

          passTotal.saved += response.data.saved || 0;
          passTotal.extracted += response.data.extracted || 0;
          passTotal.skipped += response.data.skipped_duplicates || 0;
        }

        passResults[pass.id] = passTotal;
        setCompletedPasses(prev => [...prev, pass.id]);
      }

      setResults({
        success: true,
        passes: passResults,
        total: Object.values(passResults).reduce((sum, p) => sum + p.saved, 0)
      });

      setTranscript('');
      queryClient.invalidateQueries({ queryKey: ['knowledge', venueId] });
    } catch (error) {
      console.error('Processing error:', error);
      setResults({ success: false, error: error.message || 'Processing failed' });
    } finally {
      setProcessing(false);
      setCurrentPass(null);
      setCurrentChunk(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">6-Pass Intelligence Analysis</h3>
        <p className="text-sm text-stone-600 mb-4">
          Paste conversation transcripts to automatically extract pricing, capacity, policies, amenities, 
          brand voice, and handoff rules across 6 specialized analysis passes.
        </p>
      </div>

      {/* How It Works */}
      <div className="border border-stone-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowHowItWorks(!showHowItWorks)}
          className="w-full flex items-center justify-between p-4 bg-stone-50 hover:bg-stone-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-stone-600" />
            <span className="font-medium text-sm">How It Works</span>
          </div>
          {showHowItWorks ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showHowItWorks && (
          <div className="p-4 space-y-3 border-t border-stone-200">
            {PASSES.map((pass) => {
              const Icon = pass.icon;
              return (
                <div key={pass.id} className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 mt-0.5 ${pass.color}`} />
                  <div>
                    <div className="font-medium text-sm">{pass.label}</div>
                    <div className="text-xs text-stone-600 mt-0.5">
                      {pass.id === 'pricing' && 'Extracts all pricing with conditions, packages, add-ons, and confusion risks'}
                      {pass.id === 'capacity' && 'Identifies capacity limits, objections, workarounds, and response strategies'}
                      {pass.id === 'policies' && 'Captures booking policies, requirements, sales workflow, and payment terms'}
                      {pass.id === 'amenities' && 'Details ceremony spaces, reception areas, lodging, grounds, and venue features'}
                      {pass.id === 'brand_voice' && 'Analyzes communication style, greetings, affirmations, and hospitality patterns'}
                      {pass.id === 'handoff' && 'Flags topics requiring human planner expertise and handoff protocols'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Textarea */}
      <Textarea
        placeholder="Paste conversation transcript here...

Example:
Bride: What's included in your pricing?
Venue: For peak season Saturdays with 100 guests, our base package starts at $8,500...
Bride: What if we want more than 120 guests?
Venue: We can accommodate up to 150 with a tent extension for $2,000..."
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        className="min-h-[300px] font-mono text-sm"
        disabled={processing}
      />

      {/* Stats */}
      {transcript && !processing && (
        <div className="flex items-center gap-6 text-xs text-stone-600">
          <div>📄 {lineCount.toLocaleString()} lines</div>
          <div>📦 ~{estimatedChunks} chunk{estimatedChunks !== 1 ? 's' : ''}</div>
          <div>⏱️ ~{Math.ceil(estimatedTime / 60)} min</div>
        </div>
      )}

      {/* Action Button */}
      <div className="flex items-center justify-between">
        <Button
          onClick={handleProcess}
          disabled={!transcript.trim() || processing}
          className="gap-2"
        >
          {processing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Run 6-Pass Intelligence Analysis
            </>
          )}
        </Button>

        {results && !processing && (
          <div className={`flex items-center gap-2 text-sm ${results.success ? 'text-green-600' : 'text-red-600'}`}>
            {results.success ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                {results.total} entries saved
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4" />
                Error: {results.error}
              </>
            )}
          </div>
        )}
      </div>

      {/* Processing Progress */}
      {processing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span className="font-medium text-sm text-blue-900">
              Pass {completedPasses.length + 1}/6: {PASSES.find(p => p.id === currentPass)?.label}
            </span>
            <span className="text-xs text-blue-600">
              (Chunk {currentChunk}/{totalChunks})
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PASSES.map((pass) => {
              const Icon = pass.icon;
              const isCompleted = completedPasses.includes(pass.id);
              const isCurrent = currentPass === pass.id;

              return (
                <div
                  key={pass.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs ${
                    isCompleted ? 'bg-green-100 text-green-800' : 
                    isCurrent ? 'bg-blue-100 text-blue-800' : 
                    'bg-stone-100 text-stone-500'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <Icon className="w-3 h-3" />
                  )}
                  <span className="truncate">{pass.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Results Summary */}
      {results && results.success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-green-900 font-medium">
            <CheckCircle2 className="w-5 h-5" />
            Analysis Complete!
          </div>

          <div className="space-y-2">
            {PASSES.map((pass) => {
              const data = results.passes[pass.id];
              if (!data || data.saved === 0) return null;

              const Icon = pass.icon;
              return (
                <div key={pass.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${pass.color}`} />
                    <span className="text-stone-700">{pass.label}</span>
                  </div>
                  <span className="font-medium text-stone-900">
                    {data.saved} saved
                    {data.skipped > 0 && (
                      <span className="text-xs text-stone-500 ml-1">
                        ({data.skipped} duplicate{data.skipped !== 1 ? 's' : ''})
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-green-200 text-xs text-green-800">
            💡 Entries with low confidence are flagged for review in the Knowledge Base
          </div>
        </div>
      )}
    </div>
  );
}