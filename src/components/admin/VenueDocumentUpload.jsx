import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, CheckCircle2, AlertCircle, Upload } from 'lucide-react';
import { REQUIRED_TOPICS } from './onboardingQuestions';

const labelFor = (topic) => {
  const match = REQUIRED_TOPICS.find(t => t.topic === topic);
  return match ? match.label : topic.replace(/_/g, ' ');
};

export default function VenueDocumentUpload({ venueId }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | uploading | extracting | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  const handleFileChange = (e) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setFile(picked);
    setResult(null);
    setError(null);
    setStatus('idle');
  };

  const handleProcess = async () => {
    if (!file || !venueId) return;
    setError(null);
    setResult(null);

    try {
      setStatus('uploading');
      const uploaded = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploaded?.file_url || uploaded?.url;
      if (!fileUrl) throw new Error('Upload succeeded but no file URL came back.');

      setStatus('extracting');
      const response = await base44.functions.invoke('processVenueDocument', {
        venue_id: venueId,
        file_url: fileUrl,
        document_name: file.name
      });

      const data = response?.data;
      if (!data || data.error) {
        throw new Error(data?.detail || data?.error || 'Extraction failed.');
      }

      setResult(data);
      setStatus('done');
      queryClient.invalidateQueries({ queryKey: ['knowledge', venueId] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-active', venueId] });
    } catch (err) {
      console.error('Document processing failed:', err);
      setError(err?.message || 'Something went wrong reading that document.');
      setStatus('error');
    }
  };

  const busy = status === 'uploading' || status === 'extracting';

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Upload Your Pricing Document</h3>
        <p className="text-sm text-stone-600">
          Already have a brochure or pricing sheet? Upload it and we'll pull out what we
          can, so you only have to fill in what's missing. Nothing goes live until you
          review and approve it.
        </p>
      </div>

      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
        <p className="text-sm text-stone-700 font-medium mb-1">PDF files only</p>
        <p className="text-xs text-stone-600">
          Have a Word or Google Doc? Open it and choose File → Download → PDF, then upload
          that. Takes a few seconds.
        </p>
      </div>

      <div className="border-2 border-dashed border-stone-300 rounded-xl p-6 text-center">
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleFileChange}
          disabled={busy}
          id="venue-doc-input"
          className="hidden"
        />
        <label htmlFor="venue-doc-input" className="cursor-pointer inline-flex flex-col items-center gap-2">
          <FileText className="w-8 h-8 text-stone-400" />
          <span className="text-sm font-medium text-stone-700">
            {file ? file.name : 'Choose a PDF'}
          </span>
          {!file && <span className="text-xs text-stone-500">Click to browse</span>}
        </label>
      </div>

      <Button onClick={handleProcess} disabled={!file || busy} className="gap-2">
        {status === 'uploading' && (<><Loader2 className="w-4 h-4 animate-spin" />Uploading...</>)}
        {status === 'extracting' && (<><Loader2 className="w-4 h-4 animate-spin" />Reading your document...</>)}
        {!busy && (<><Upload className="w-4 h-4" />Read This Document</>)}
      </Button>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-900 font-medium">Couldn't read that document</p>
            <p className="text-xs text-red-800 mt-1">{error}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-green-900 font-medium mb-1">
              <CheckCircle2 className="w-5 h-5" />
              Found {result.created} {result.created === 1 ? 'fact' : 'facts'} in your document
            </div>
            <p className="text-xs text-green-800">
              These are saved as drafts. Head to Chatbot Training, filter to "Awaiting
              review", and approve the ones that look right.
              {result.skipped > 0 && ` (${result.skipped} were skipped as duplicates or unusable.)`}
            </p>
          </div>

          {result.topicsFound?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-stone-900 mb-2">What we got</p>
              <div className="space-y-1">
                {result.topicsFound.map(t => (
                  <div key={t} className="flex items-center justify-between text-sm py-1.5 border-b border-stone-100">
                    <span className="text-stone-700">{labelFor(t)}</span>
                    <span className="text-xs text-stone-500">
                      {result.byTopic[t]} {result.byTopic[t] === 1 ? 'entry' : 'entries'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.topicsMissing?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-stone-900 mb-2">
                Still needs your input
              </p>
              <p className="text-xs text-stone-600 mb-2">
                Your document didn't cover these, so brides asking about them won't get an
                answer yet.
              </p>
              <div className="space-y-1">
                {result.topicsMissing.map(t => (
                  <div key={t} className="text-sm py-1.5 border-b border-stone-100 text-stone-700">
                    {labelFor(t)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}