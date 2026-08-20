import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, Check, Loader2, Clock, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { ONBOARDING_STEPS } from './onboardingSteps';

export default function VenueOnboardingWizard({ venueId, initialTopic, onComplete }) {
  // If a checklist topic has no matching step, findIndex returns -1 and this
  // silently opens step one. REQUIRED_TOPICS and ONBOARDING_STEPS are two
  // lists in two files with no enforcement, so warn loudly when they drift.
  const requestedIndex = ONBOARDING_STEPS.findIndex(s => s.topic === initialTopic);
  if (initialTopic && requestedIndex === -1) {
    console.warn(`[VenueOnboardingWizard] No step found for topic "${initialTopic}" — REQUIRED_TOPICS and ONBOARDING_STEPS have drifted. Opening step one instead.`);
  }
  const startIndex = Math.max(0, requestedIndex);
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [answers, setAnswers] = useState({});
  const [successMessage, setSuccessMessage] = useState(null);
  const queryClient = useQueryClient();

  const currentStep = ONBOARDING_STEPS[currentIndex];

  const { data: progressRecords } = useQuery({
    queryKey: ['onboarding-progress', venueId],
    queryFn: () => base44.entities.VenueOnboardingProgress.filter({ venue_id: venueId }),
    enabled: !!venueId
  });

  const progress = progressRecords?.[0];
  // Records created before topic_answers/topic_status existed have no key for
  // either field — the schema default only applies on write. Always default.
  const topicAnswers = progress?.topic_answers || {};
  const topicStatus = progress?.topic_status || {};

  useEffect(() => {
    const saved = topicAnswers[currentStep.topic];
    setAnswers(saved && typeof saved === 'object' ? saved : {});
    setSuccessMessage(null);
  }, [currentIndex, progress, currentStep.topic]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('processOnboardingAnswers', {
        venue_id: venueId,
        topic: currentStep.topic,
        answers
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-progress', venueId] });
      queryClient.invalidateQueries({ queryKey: ['knowledge', venueId] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-active', venueId] });
      setSuccessMessage(
        `Saved. We drafted ${data?.created ?? 0} answer${data?.created === 1 ? '' : 's'} for your chatbot — review and approve them in Chatbot Training before they go live.`
      );
    }
  });

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSave = () => {
    const missing = currentStep.questions
      .filter(q => q.required)
      .filter(q => !answers[q.id] || !answers[q.id].trim());
    if (missing.length > 0) {
      alert(`Please fill in: ${missing.map(q => q.label).join(', ')}`);
      return;
    }
    saveMutation.mutate();
  };

  const goNext = () => {
    if (currentIndex < ONBOARDING_STEPS.length - 1) setCurrentIndex(i => i + 1);
    else if (onComplete) onComplete();
  };

  const statusOf = (topic) => topicStatus[topic] || 'not_started';
  const completedCount = ONBOARDING_STEPS.filter(s => statusOf(s.topic) !== 'not_started').length;
  const isCurrentDone = statusOf(currentStep.topic) !== 'not_started';

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step chips — a 13-step circle-and-connector bar is unreadable on a
          phone, so this is a wrapping grid of short labels instead. */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-stone-900">
            Step {currentIndex + 1} of {ONBOARDING_STEPS.length}
          </p>
          <p className="text-xs text-stone-500">{completedCount} started</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ONBOARDING_STEPS.map((step, index) => {
            const done = statusOf(step.topic) !== 'not_started';
            const isCurrent = index === currentIndex;
            return (
              <button
                key={step.topic}
                onClick={() => setCurrentIndex(index)}
                className={`text-xs px-2.5 py-1.5 rounded-full transition-colors ${
                  isCurrent
                    ? 'bg-stone-900 text-white'
                    : done
                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                }`}
              >
                {done && !isCurrent && <Check className="w-3 h-3 inline mr-1" />}
                {step.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step header */}
      <div className="bg-white border-2 border-stone-200 rounded-xl p-5 mb-6">
        <h2 className="text-xl font-bold text-stone-900 mb-1">{currentStep.title}</h2>
        <p className="text-stone-600 text-sm mb-3">{currentStep.description}</p>
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <Clock className="w-3.5 h-3.5" />
          <span>about {currentStep.estimatedMinutes} minutes</span>
        </div>
      </div>

      {successMessage && (
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-green-900 font-medium">{successMessage}</p>
            {currentIndex < ONBOARDING_STEPS.length - 1 && (
              <button onClick={goNext} className="text-sm text-green-700 hover:text-green-900 font-medium mt-2 flex items-center gap-1">
                Next step <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {saveMutation.isError && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-900 font-medium">Couldn't save that step</p>
            <p className="text-xs text-red-800 mt-1">{saveMutation.error?.message || 'Something went wrong. Your answers are still here — try again.'}</p>
          </div>
        </div>
      )}

      {/* Questions */}
      <div className="space-y-6 mb-8">
        {currentStep.questions.map((question) => (
          <div key={question.id}>
            <label className="block font-semibold text-stone-900 mb-1">
              {question.label}
              {question.required && <span className="text-red-600 ml-1">*</span>}
            </label>
            <p className="text-sm text-stone-600 mb-2">{question.helpText}</p>
            <Textarea
              placeholder={question.placeholder}
              value={answers[question.id] || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              rows={4}
              className="bg-white border-stone-200 rounded-xl text-sm resize-none"
            />
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t-2 border-stone-200 pt-6">
        {currentIndex > 0 ? (
          <Button variant="ghost" onClick={() => setCurrentIndex(i => i - 1)} className="gap-2">
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>
        ) : <div />}

        <div className="flex items-center gap-3">
          <button onClick={goNext} className="text-sm text-stone-600 hover:text-stone-900">
            Skip for now
          </button>
          <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-stone-900 hover:bg-stone-800 rounded-full gap-2">
            {saveMutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
              : isCurrentDone ? <><Check className="w-4 h-4" />Save again</> : 'Save this step'}
          </Button>
        </div>
      </div>
    </div>
  );
}