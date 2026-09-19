import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, Loader2 } from 'lucide-react';
import { ONBOARDING_STEPS } from './onboardingSteps';
import { getOnboardingTopicState, nextUnansweredStep } from './onboardingQuestions';

const labels = { covered: 'Covered', review: 'Needs review', unanswered: 'Unanswered' };

export default function VenueOnboardingWizard({ venueId, initialTopic, onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(Math.max(0, ONBOARDING_STEPS.findIndex(s => s.topic === initialTopic)));
  const [drafts, setDrafts] = useState({});
  const [skipped, setSkipped] = useState([]);
  const [savedTopics, setSavedTopics] = useState([]);
  const [message, setMessage] = useState('');
  const [finished, setFinished] = useState(false);
  const [editing, setEditing] = useState(false);
  const top = useRef(null);
  const queryClient = useQueryClient();
  const progressQuery = useQuery({
    queryKey: ['onboarding-progress', venueId],
    queryFn: () => base44.entities.VenueOnboardingProgress.filter({ venue_id: venueId }),
    enabled: !!venueId
  });
  const knowledgeQuery = useQuery({
    queryKey: ['onboarding-knowledge', venueId],
    queryFn: () => base44.entities.VenueKnowledge.filter({ venue_id: venueId }),
    enabled: !!venueId
  });
  const knowledge = knowledgeQuery.data || [];
  const step = ONBOARDING_STEPS[currentIndex];
  const answers = drafts[step.topic] ?? progressQuery.data?.[0]?.topic_answers?.[step.topic] ?? {};
  const stateOf = topic => getOnboardingTopicState(topic, knowledge);
  const state = stateOf(step.topic);
  const entries = knowledge.filter(k => k.topic === step.topic && (k.is_active || k.needs_review));
  const coveredCount = ONBOARDING_STEPS.filter(s => stateOf(s.topic) === 'covered').length;
  const reviewCount = ONBOARDING_STEPS.filter(s => stateOf(s.topic) === 'review' || (stateOf(s.topic) === 'unanswered' && savedTopics.includes(s.topic))).length;

  const openStep = index => {
    setCurrentIndex(index);
    setEditing(false);
    setFinished(false);
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const advance = (extraExcluded = [], latestKnowledge = knowledge) => {
    const next = nextUnansweredStep(ONBOARDING_STEPS, currentIndex, latestKnowledge, [...skipped, ...savedTopics, ...extraExcluded]);
    if (next === -1) setFinished(true);
    else openStep(next);
  };
  const saveMutation = useMutation({
    mutationFn: async ({ topic, values }) => {
      const response = await base44.functions.invoke('processOnboardingAnswers', { venue_id: venueId, topic, answers: values });
      if (response.data?.success === false || response.data?.error) throw new Error(response.data.error || 'Unable to save');
      return response.data;
    },
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-progress', venueId] });
      queryClient.invalidateQueries({ queryKey: ['knowledge', venueId] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-active', venueId] });
      const refreshed = await knowledgeQuery.refetch();
      if (!(data?.created > 0)) {
        setMessage('Your answers were saved, but no review drafts were created. Please revise this topic and save again.');
        return;
      }
      setSavedTopics(previous => [...new Set([...previous, variables.topic])]);
      setMessage(`Saved ${step.title}. ${data.created} draft answer(s) need approval in Your Planner before the chatbot can use them.`);
      advance([variables.topic], refreshed.data || knowledge);
    }
  });
  const save = () => {
    const missing = step.questions.filter(q => q.required && !String(answers[q.id] || '').trim());
    if (missing.length) {
      setMessage('Please answer the required questions before saving: ' + missing.map(q => q.label).join(', '));
      return;
    }
    setMessage('');
    saveMutation.mutate({ topic: step.topic, values: answers });
  };
  const skip = () => {
    setSkipped(previous => [...new Set([...previous, step.topic])]);
    setMessage('Skipped for now. This topic will remain unanswered.');
    advance([step.topic]);
  };
  const busy = saveMutation.isPending;
  if (progressQuery.isPending || knowledgeQuery.isPending) return <p role="status">Loading your saved information…</p>;
  if (progressQuery.isError || knowledgeQuery.isError) return <div role="alert">Unable to load your saved information. <Button onClick={() => { progressQuery.refetch(); knowledgeQuery.refetch(); }}>Try again</Button></div>;

  return (
    <div ref={top} className="max-w-2xl mx-auto scroll-mt-28">
      <div className="mb-6">
        <p className="text-sm font-medium mb-2">{coveredCount} covered · {reviewCount} need review · {ONBOARDING_STEPS.length - coveredCount - reviewCount} unanswered</p>
        <p className="text-xs text-stone-500 mb-3">Saving moves to the next unanswered topic. Covered topics are skipped automatically; you can review any topic below.</p>
        <div className="flex flex-wrap gap-1.5">
          {ONBOARDING_STEPS.map((item, index) => {
            const status = stateOf(item.topic);
            return <button key={item.topic} disabled={busy} onClick={() => { setMessage(''); openStep(index); }}
              aria-current={!finished && index === currentIndex ? 'step' : undefined}
              className={`text-xs px-2.5 py-1.5 rounded-full ${!finished && index === currentIndex ? 'bg-stone-900 text-white' : status === 'covered' ? 'bg-green-100 text-green-800' : status === 'review' ? 'bg-amber-100 text-amber-900' : 'bg-stone-100 text-stone-600'}`}>
              {status === 'covered' && <Check className="w-3 h-3 inline mr-1" />}{item.title} · {labels[status]}
            </button>;
          })}
        </div>
      </div>
      {message && <p role="status" className="rounded-xl bg-stone-100 p-4 mb-5 text-sm">{message}</p>}
      {saveMutation.isError && <p role="alert" className="text-red-700 mb-4">Could not save. Your answers are still here. {saveMutation.error?.message}</p>}
      {finished ? <div className="border rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-semibold">You've reached the end of this pass</h2>
        <p className="text-sm text-stone-600">Saved drafts still need approval in Your Planner. Skipped topics remain unanswered. You can return to any topic above.</p>
        <Button onClick={onComplete}>Back to dashboard</Button>
      </div> : <>
        <div className="border rounded-xl p-5 mb-6">
          <h2 className="text-xl font-bold mb-1">{step.title}</h2>
          <p className="text-sm text-stone-600">{step.description}</p>
          <p className="text-xs mt-3">{labels[state]} · About {step.estimatedMinutes} minutes</p>
        </div>
        {entries.length > 0 && <div className="border rounded-xl p-5 mb-6">
          <h3 className="font-semibold mb-2">{state === 'covered' ? 'Existing chatbot knowledge' : 'Saved drafts awaiting approval'}</h3>
          <p className="text-sm text-stone-600 mb-3">Covered means this topic has active knowledge, not that every question below has been answered. Information imported or entered elsewhere does not fill in this questionnaire.</p>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {entries.map(entry => <details key={entry.id} className="text-sm">
              <summary className="cursor-pointer font-medium">{entry.question} <span className="text-xs text-stone-500">({entry.is_active ? 'Active' : 'Needs review'})</span></summary>
              <p className="mt-2 whitespace-pre-wrap">{entry.answer}</p>
            </details>)}
          </div>
          <p className="text-xs text-stone-500 mt-3">Review or edit these entries in Your Planner. Adding answers here creates new drafts and keeps existing knowledge.</p>
          {!editing && <Button variant="outline" className="mt-4" onClick={() => setEditing(true)}>Add or update questionnaire answers</Button>}
        </div>}
        {(state === 'unanswered' || editing) && <div className="space-y-6 mb-8">
          {step.questions.map(question => <div key={question.id}>
            <label htmlFor={question.id} className="block font-semibold mb-1">{question.label}{question.required && <span className="text-red-600 ml-1">*</span>}</label>
            <p className="text-sm text-stone-600 mb-2">{question.helpText}</p>
            <Textarea id={question.id} disabled={busy} placeholder={question.placeholder} value={answers[question.id] || ''}
              onChange={event => setDrafts(previous => ({ ...previous, [step.topic]: { ...answers, [question.id]: event.target.value } }))}
              rows={4} className="rounded-xl" />
          </div>)}
        </div>}
        <div className="flex flex-wrap justify-end gap-3 border-t pt-6">
          <Button variant="ghost" disabled={busy} onClick={state === 'unanswered' ? skip : () => advance()}>
            {state === 'unanswered' ? 'Skip for now' : 'Next unanswered topic'}
          </Button>
          {(state === 'unanswered' || editing) && <Button disabled={busy} onClick={save}>
            {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : 'Save & continue'}
          </Button>}
        </div>
      </>}
    </div>
  );
}
