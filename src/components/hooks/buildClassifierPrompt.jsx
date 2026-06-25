// Builds the STEP 1 intent-classifier prompt + JSON schema for the chatbot.
// Pure: every input arrives as an argument (the hook reads refs/state at the call
// site and passes the values in), and this returns the assembled prompt string. The
// string the classifier receives is byte-identical to the previous inline version,
// so classification behavior is unchanged.

export const CLASSIFIER_SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: ['general', 'date_inquiry', 'tour_interest', 'package_inquiry', 'visual_request'] },
    topic: { type: 'string', enum: ['catering','desserts','alcohol_bar','packages_pricing','ceremony_spaces','reception_spaces','lodging','coordination_planning','payment_deposits','decor_rentals','photography_video','capacity_guests','vendors','rules_policies','amenities','availability_dates','tours','getting_ready','general'] },
    wedding_date: { type: ['string', 'null'] },
    wedding_dates: { type: ['array', 'null'], items: { type: 'string' } },
    year_missing: { type: ['boolean', 'null'] },
    month: { type: ['number', 'null'] },
    day: { type: ['number', 'null'] },
    year: { type: ['number', 'null'] },
    stated_weekday: { type: ['string', 'null'], enum: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday', null] },
    guest_count: { type: ['number', 'null'] },
    handoff_response: { type: ['string', 'null'], enum: ['accepted', 'declined', 'unrelated', null] },
  },
  required: ['intent']
};

export function buildClassifierPrompt({
  text,
  today,
  tz,
  recentHistory,
  plannerNameForClassifier,
  handoffPending,
  currentTopic,
  pendingAction,
  knownGuestCount,
  knownYear,
  knownDate,
}) {
  const handoffPendingBlock = handoffPending ? `
A handoff offer (having ${plannerNameForClassifier} text the bride) is currently pending. Additionally return handoff_response: 'accepted' if this message clearly accepts being contacted (e.g. 'yes', 'sure', 'yes please text me'), 'declined' if it declines, or 'unrelated' otherwise. Farewells ('ok bye'), reactions ('wow'), and new questions are 'unrelated' — NEVER 'accepted'.
` : '';

  const conversationStateBlock = `
CONVERSATION STATE (for continuity — use it, do not repeat it back):
- Current topic: ${currentTopic || 'none yet'}
- Pending action: ${pendingAction || 'none'}
- Known guest count: ${knownGuestCount ?? 'unknown'}
- Known year: ${knownYear ?? 'unknown'}
- Known date: ${knownDate || 'unknown'}

Continuity rules:
- If Pending action is "awaiting_quote_details", the previous turn asked her for her date and/or guest count to give a PRICE. If her current message simply supplies a date, month, year, and/or guest count WITHOUT asking a new question (e.g. "October 2027 Saturday", "120 guests", "a Saturday in the fall"), classify intent as package_inquiry — she is completing the pricing request, NOT starting an availability inquiry. If she instead asks a distinct question (including explicitly asking which dates are open/available), classify by that question as normal.
- If her message is a short continuation ("yes", "that one", "the 23rd") that names no new topic, keep topic = the Current topic above rather than defaulting to general.
`;

  return `You classify a bride's message to a wedding venue chatbot.

Today's date: ${today}
Venue timezone: ${tz}

Recent conversation (last 6 messages):
${recentHistory}

Current user message: "${text}"
${conversationStateBlock}
Classify into one intent:
- "date_inquiry": asking whether a specific date or timeframe is available
- "tour_interest": wants to visit, see the venue in person, schedule a tour
- "package_inquiry": asking about packages, pricing tiers, what's included, costs, budget
- "visual_request": asking to see photos, what spaces look like, gallery
- "general": everything else (FAQs, policies, amenities, etc.)

When a message fits multiple intents, prefer the action intent (date_inquiry or tour_interest) over general.

Extract wedding_date — be careful and precise:
- Resolve to YYYY-MM-DD when the bride gives an exact day she is asking about.
- ALWAYS preserve a year she states, regardless of word order or phrasing. "2027 Saturday October 22", "October 22 2027", "10/22/27", "next fall 2027", "fall of 2027 on October 22" all mean the year 2027. NEVER override or "correct" a stated year — even if it conflicts with a weekday she mentions, even if it seems unusual.
- If she gives a month and day but NO year at all (e.g. "October 17th", "10/17"), do NOT guess and do NOT resolve to the next future occurrence. Return wedding_date as null and set year_missing: true, and return month (1-12) and day (1-31) so we can ask her for the year.
- If she only mentions a month, season, or vague timeframe with no specific day ("next fall", "summer", "October"), return wedding_date null and year_missing false.
- Use today's date only to choose the future occurrence when she gives a day-of-month and an explicit year both — never to fill in a missing year.

Extract stated_weekday — the literal weekday word she wrote ("Saturday", "Sunday", "Friday", "Monday", "Tuesday", "Wednesday", "Thursday"), case-normalized. If she did not name a weekday, return null. Do NOT compute it from the date. Just capture the word she used.

Extract year: the 4-digit year she states anywhere — including when she gives NO day (e.g. "2027", "fall of 2027", "October 2027 Saturday"). Preserve it exactly; never infer a year she didn't state. Null if she stated no year.

Extract guest_count: number if mentioned anywhere in recent context, otherwise null.

Also classify the PRIMARY topic of the bride's current message from this fixed vocabulary:
- catering: food, caterers, menu, dietary, tastings, plated vs buffet
- desserts: cake, cupcakes, cookies, sweets, dessert table
- alcohol_bar: drinks, bar, alcohol, beer, wine, signature cocktails, bartender
- packages_pricing: package options, what's included, total cost, price tiers, budget
- ceremony_spaces: where the ceremony happens, outdoor/indoor ceremony locations, arbor, aisle
- reception_spaces: reception room/tent/barn, where dinner & dancing happen
- lodging: on-site stay, cabins, hotels nearby, accommodations
- coordination_planning: day-of coordinator, planning support, timeline help, vendor management
- payment_deposits: deposits, payment schedule, refund policy, contracts
- decor_rentals: tables, chairs, linens, arches, in-house decor, rental items
- photography_video: photographer, videographer, photo/video vendors
- capacity_guests: max guest count, minimums, kids policy, plus-ones
- vendors: outside vendor policy, preferred vendor list, vendor restrictions
- rules_policies: noise/end times, fireworks, sparklers, pets, smoking, candles
- amenities: bridal suite, grooms room, parking, AV, wifi, heating/cooling, restrooms
- availability_dates: open/booked dates, calendar, peak vs off-season
- tours: visiting the venue, scheduling a walk-through
- getting_ready: bridal suite use, getting-ready timing, hair & makeup space
- general: greetings, intros, vibe questions, anything else

When a message spans topics, return the PRIMARY one.
${handoffPendingBlock}`;
}