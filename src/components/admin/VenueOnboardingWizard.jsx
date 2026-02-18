import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Building2,
  FileText,
  HelpCircle,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  Clock,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Circle
} from 'lucide-react';
import { ONBOARDING_SECTIONS } from './onboardingQuestions';

const iconMap = {
  Building2,
  FileText,
  HelpCircle,
  Sparkles
};

export default function VenueOnboardingWizard({ venueId, onComplete }) {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [successMessage, setSuccessMessage] = useState(null);
  const queryClient = useQueryClient();

  const currentSection = ONBOARDING_SECTIONS[currentSectionIndex];
  const Icon = iconMap[currentSection.icon];

  // Load existing progress
  const { data: progressRecords } = useQuery({
    queryKey: ['onboarding-progress', venueId],
    queryFn: () => base44.entities.VenueOnboardingProgress.filter({ venue_id: venueId }),
    enabled: !!venueId
  });

  const progress = progressRecords?.[0];

  // Pre-populate answers from saved progress
  useEffect(() => {
    if (progress && currentSection) {
      const savedAnswers = progress[`answers_${currentSection.id}`];
      if (savedAnswers && typeof savedAnswers === 'object') {
        setAnswers(savedAnswers);
      } else {
        setAnswers({});
      }
    } else {
      setAnswers({});
    }
    setSuccessMessage(null);
  }, [currentSectionIndex, progress, currentSection]);

  // Save section mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('processOnboardingAnswers', {
        venue_id: venueId,
        section_id: currentSection.id,
        answers,
        regenerate: true
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-progress', venueId] });
      queryClient.invalidateQueries({ queryKey: ['knowledge', venueId] });
      setSuccessMessage(`Section saved! Generated ${data.created} knowledge entries.`);
    }
  });

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSave = () => {
    // Validate required fields
    const missingRequired = currentSection.questions
      .filter(q => q.required)
      .filter(q => !answers[q.id] || !answers[q.id].trim());

    if (missingRequired.length > 0) {
      alert(`Please fill in all required fields: ${missingRequired.map(q => q.label).join(', ')}`);
      return;
    }

    saveMutation.mutate();
  };

  const handleNext = () => {
    if (currentSectionIndex < ONBOARDING_SECTIONS.length - 1) {
      setCurrentSectionIndex(prev => prev + 1);
    } else if (onComplete) {
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(prev => prev - 1);
    }
  };

  const getSectionStatus = (sectionId) => {
    if (!progress) return 'not_started';
    return progress[`section_${sectionId}`] || 'not_started';
  };

  const isCurrentSectionComplete = getSectionStatus(currentSection.id) === 'complete' || getSectionStatus(currentSection.id) === 'auto_complete';

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {ONBOARDING_SECTIONS.map((section, index) => {
            const status = getSectionStatus(section.id);
            const isCurrent = index === currentSectionIndex;
            const isComplete = status === 'complete' || status === 'auto_complete';
            const isInProgress = status === 'in_progress';

            return (
              <React.Fragment key={section.id}>
                <button
                  onClick={() => setCurrentSectionIndex(index)}
                  className={`flex flex-col items-center gap-2 transition-all ${
                    isCurrent ? 'scale-110' : 'hover:scale-105'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold transition-all ${
                      isCurrent
                        ? 'bg-stone-900 text-white ring-4 ring-stone-900/20'
                        : isComplete
                        ? 'bg-green-100 text-green-700'
                        : isInProgress
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-stone-100 text-stone-400'
                    }`}
                  >
                    {isComplete ? (
                      <Check className="w-6 h-6" />
                    ) : isCurrent ? (
                      <CircleDot className="w-6 h-6" />
                    ) : (
                      <Circle className="w-6 h-6" />
                    )}
                  </div>
                  <span className="text-xs text-stone-600 hidden sm:block">{section.title.split(' ')[0]}</span>
                </button>
                {index < ONBOARDING_SECTIONS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${isComplete ? 'bg-green-200' : 'bg-stone-200'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Section Header */}
      <div className="bg-white border-2 border-stone-200 rounded-xl p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center flex-shrink-0">
            <Icon className="w-6 h-6 text-stone-700" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-stone-900 mb-2">{currentSection.title}</h2>
            <p className="text-stone-600 mb-3">{currentSection.description}</p>
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <Clock className="w-4 h-4" />
              <span>~{currentSection.estimatedMinutes} minutes</span>
            </div>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-green-900 font-medium">{successMessage}</p>
            {currentSectionIndex < ONBOARDING_SECTIONS.length - 1 && (
              <button
                onClick={handleNext}
                className="text-sm text-green-700 hover:text-green-900 font-medium mt-2 flex items-center gap-1"
              >
                Continue to next section <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Questions */}
      <div className="space-y-6 mb-8">
        {currentSection.questions.map((question) => (
          <div key={question.id}>
            <label className="block font-semibold text-stone-900 mb-2">
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
        <div className="flex items-center gap-3">
          {currentSectionIndex > 0 && (
            <Button
              variant="ghost"
              onClick={handleBack}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!isCurrentSectionComplete && (
            <button
              onClick={handleNext}
              className="text-sm text-stone-600 hover:text-stone-900"
            >
              Skip for now
            </button>
          )}
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="bg-stone-900 hover:bg-stone-800 rounded-full gap-2"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Q&As...
              </>
            ) : isCurrentSectionComplete ? (
              <>
                <Check className="w-4 h-4" />
                Re-generate
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Save & Generate
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}