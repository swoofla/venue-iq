import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  Brain,
  Check,
  ChevronRight,
  Circle,
  CircleDot,
  AlertCircle,
  Building2,
  FileText,
  HelpCircle,
  Sparkles,
  Package,
  Calculator,
  Upload,
  Settings
} from 'lucide-react';
import { calculateReadinessScore } from '@/components/admin/onboardingQuestions';

const sectionIcons = {
  venue_basics: Settings,
  packages: Package,
  pricing: Calculator,
  spaces: Building2,
  policies: FileText,
  faq: HelpCircle,
  personality: Sparkles,
  transcripts: Upload
};

export default function OnboardingReadiness({ venueId, onStartOnboarding }) {
  const { data: progressRecords } = useQuery({
    queryKey: ['onboarding-progress', venueId],
    queryFn: () => base44.entities.VenueOnboardingProgress.filter({ venue_id: venueId }),
    enabled: !!venueId
  });

  const { data: packages = [] } = useQuery({
    queryKey: ['packages', venueId],
    queryFn: () => base44.entities.VenuePackage.filter({ venue_id: venueId, is_active: true }),
    enabled: !!venueId
  });

  const { data: pricingConfigs = [] } = useQuery({
    queryKey: ['pricing', venueId],
    queryFn: () => base44.entities.WeddingPricingConfiguration.filter({ venue_id: venueId }),
    enabled: !!venueId
  });

  const { data: venue } = useQuery({
    queryKey: ['venue', venueId],
    queryFn: () => base44.entities.Venue.get(venueId),
    enabled: !!venueId
  });

  const { data: knowledge = [] } = useQuery({
    queryKey: ['knowledge', venueId],
    queryFn: () => base44.entities.VenueKnowledge.filter({ venue_id: venueId, is_active: true }),
    enabled: !!venueId
  });

  if (!venueId) return null;

  const progress = progressRecords?.[0];
  const hasVenueBasics = venue?.name && venue?.location;
  const hasPackages = packages.length > 0;
  const hasPricing = pricingConfigs.length > 0;

  const score = calculateReadinessScore(progress, hasPackages, hasPricing, hasVenueBasics);

  // Don't render if fully ready
  if (score === 100) return null;

  const sections = [
    {
      id: 'venue_basics',
      label: 'Venue Settings',
      status: hasVenueBasics ? 'complete' : 'not_started',
      isAuto: true,
      subtext: 'Auto-detected from your settings'
    },
    {
      id: 'packages',
      label: 'Packages',
      status: hasPackages ? 'complete' : 'not_started',
      isAuto: true,
      subtext: 'Auto-detected from your settings'
    },
    {
      id: 'pricing',
      label: 'Budget Calculator Pricing',
      status: hasPricing ? 'complete' : 'not_started',
      isAuto: true,
      subtext: 'Auto-detected from your settings'
    },
    {
      id: 'spaces',
      label: 'Spaces & Amenities',
      status: progress?.section_spaces || 'not_started',
      isAuto: false
    },
    {
      id: 'policies',
      label: 'Policies & Logistics',
      status: progress?.section_policies || 'not_started',
      isAuto: false
    },
    {
      id: 'faq',
      label: 'Common Questions',
      status: progress?.section_faq || 'not_started',
      isAuto: false
    },
    {
      id: 'personality',
      label: "Venue Personality",
      status: progress?.section_personality || 'not_started',
      isAuto: false
    },
    {
      id: 'transcripts',
      label: 'Conversation Transcripts',
      status: progress?.section_transcripts || 'not_started',
      isAuto: false,
      isOptional: true,
      subtext: 'Optional — bonus points!'
    }
  ];

  const completedSections = sections.filter(s => s.status === 'complete' || s.status === 'auto_complete').length;
  const totalSections = sections.length;

  const getSubtitle = () => {
    if (score < 40) return "Your chatbot needs more info to help brides effectively.";
    if (score < 80) return "Getting there! A few more sections will make your chatbot great.";
    return "Almost ready! Just a few finishing touches.";
  };

  const getRingColor = () => {
    if (score >= 80) return 'text-green-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-red-400';
  };

  const getStatusIcon = (status) => {
    if (status === 'complete' || status === 'auto_complete') {
      return <Check className="w-5 h-5 text-green-600" />;
    }
    if (status === 'in_progress') {
      return <CircleDot className="w-5 h-5 text-amber-500" />;
    }
    return <Circle className="w-5 h-5 text-stone-300" />;
  };

  const handleSectionClick = (section) => {
    if (section.isAuto || section.status === 'complete' || section.status === 'auto_complete') return;
    onStartOnboarding(section.id);
  };

  const handleStartOnboarding = () => {
    const firstIncomplete = sections.find(
      s => !s.isAuto && !s.isOptional && s.status !== 'complete' && s.status !== 'auto_complete'
    );
    if (firstIncomplete) {
      onStartOnboarding(firstIncomplete.id);
    }
  };

  const circleRadius = 36;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center flex-shrink-0">
            <Brain className="w-5 h-5 text-stone-700" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-stone-900 mb-1">Chatbot Readiness</h3>
            <p className="text-sm text-stone-600">{getSubtitle()}</p>
            <p className="text-xs text-stone-500 mt-1">
              {knowledge.length} knowledge entries • {completedSections}/{totalSections} sections complete
            </p>
          </div>
        </div>

        {/* Progress Ring */}
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="w-20 h-20 transform -rotate-90">
            <circle
              cx="40"
              cy="40"
              r={circleRadius}
              stroke="currentColor"
              strokeWidth="6"
              fill="transparent"
              className="text-stone-100"
            />
            <circle
              cx="40"
              cy="40"
              r={circleRadius}
              stroke="currentColor"
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={`${getRingColor()} transition-all duration-500`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-stone-900">{score}%</span>
          </div>
        </div>
      </div>

      {/* Section Checklist */}
      <div className="space-y-0 mb-6">
        {sections.map((section, index) => {
          const Icon = sectionIcons[section.id];
          const isComplete = section.status === 'complete' || section.status === 'auto_complete';
          const isClickable = !section.isAuto && !isComplete;

          return (
            <div
              key={section.id}
              onClick={() => isClickable && handleSectionClick(section)}
              className={`flex items-center justify-between py-3 border-b border-stone-50 last:border-0 ${
                isClickable ? 'cursor-pointer hover:bg-stone-50 -mx-2 px-2 rounded-lg' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(section.status)}
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-stone-400" />
                  <div>
                    <p className={`text-sm font-medium ${isComplete ? 'line-through text-stone-500' : 'text-stone-900'}`}>
                      {section.label}
                    </p>
                    {section.subtext && (
                      <p className="text-xs text-stone-500">{section.subtext}</p>
                    )}
                  </div>
                </div>
              </div>
              {isClickable && <ChevronRight className="w-4 h-4 text-stone-400" />}
            </div>
          );
        })}
      </div>

      {/* CTA Button */}
      {score < 85 && (
        <Button
          onClick={handleStartOnboarding}
          className="w-full bg-stone-900 hover:bg-stone-800 text-white rounded-full"
        >
          {score > 0 ? 'Continue Onboarding' : 'Start Onboarding'}
        </Button>
      )}
    </div>
  );
}