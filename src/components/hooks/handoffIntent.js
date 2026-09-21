// Keep explicit requests independent of model classification and response wording.
export function isDirectPlannerRequest(text, venue = {}) {
  const normalized = String(text || '').toLowerCase().replace(/[’]/g, "'").trim();
  if (/\b(don't|do not|not ready|rather not|no need|never mind)\b/.test(normalized)) return false;
  const names = [venue.head_planner_name, venue.planner_name].filter(Boolean)
    .flatMap(name => [name, name.split(' ')[0]])
    .map(name => name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const person = [...names, '(?:a |the |your |our )?(?:human|person|planner|coordinator|team member)', 'someone'].join('|');
  return new RegExp(`\\b(?:talk (?:to|with)|speak (?:to|with)|connect (?:me )?(?:to|with)|contact|reach)\\s+(?:${person})\\b`).test(normalized)
    || new RegExp(`\\b(?:have|ask|can|could)\\s+(?:${person})\\s+(?:please )?(?:text|call|contact|email|reach out to)\\s+me\\b`).test(normalized);
}
