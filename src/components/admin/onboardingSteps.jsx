// Topic-first onboarding. Each step maps to exactly one VenueKnowledge topic,
// so the readiness checklist can route a venue owner straight to the step that
// fills the gap it just named. The `topic` values here MUST stay in sync with
// REQUIRED_TOPICS in onboardingQuestions.jsx — if they drift, the checklist
// will name a gap that has no step to fill it.
//
// Design rules, learned from auditing a live venue's chatbot:
//  - Every step captures what the venue does NOT offer or allow. A missing "no"
//    is what makes the bot invent policies or hand off unnecessarily.
//  - No question assumes the venue has packages, seasons, lodging, or a tent.
//  - A venue that doesn't offer something still answers the step; "we don't
//    offer this" is a usable answer and produces a usable knowledge row.

export const ONBOARDING_STEPS = [
  {
    topic: 'packages_pricing',
    title: 'What You Sell',
    description: 'The single most common thing brides ask about.',
    estimatedMinutes: 6,
    questions: [
      { id: 'offerings', label: 'What can a couple book?', required: true, helpText: 'List each option by name. If you rent the space only, say that.', placeholder: 'e.g., "Full-day rental, or an all-inclusive package. Also a weekday micro option for smaller groups."' },
      { id: 'prices', label: 'What does each one cost?', required: true, helpText: 'Give real numbers. If price varies by day, season, or guest count, spell out how.', placeholder: 'e.g., "Rental is $8,000 Saturday, $6,000 Friday/Sunday. All-inclusive is $18,000 Saturday."' },
      { id: 'price_includes', label: 'Is tax and any service fee included in those numbers?', required: true, helpText: 'Brides assume the number you quote is the number they pay. Say what is on top.', placeholder: 'e.g., "Prices include tax and service fee." or "Add 8% tax and a 20% service charge."' },
      { id: 'not_included', label: 'What is NOT included in those prices?', required: true, helpText: 'The most important question here. List everything a couple pays for separately.', placeholder: 'e.g., "Catering, alcohol, florals, photography, and DJ are all separate."' },
      { id: 'restrictions', label: 'Does any option have restrictions?', required: false, helpText: 'Days of week, seasons, guest counts, minimums. If none, write "No restrictions."', placeholder: 'e.g., "The micro option is weekdays only and caps at 50 guests."' }
    ]
  },
  {
    topic: 'capacity_guests',
    title: 'Guest Capacity',
    description: 'What fits, what does not, and what it costs to go over.',
    estimatedMinutes: 3,
    questions: [
      { id: 'max_guests', label: 'What is your maximum guest count?', required: true, helpText: 'Give the number you are comfortable with, and the absolute ceiling if different.', placeholder: 'e.g., "150 comfortably, 175 absolute maximum."' },
      { id: 'overage', label: 'What happens above your comfortable maximum?', required: true, helpText: 'A per-guest fee? A hard no? Say which. If there is a fee, give the amount.', placeholder: 'e.g., "$50 per guest over 150, and we cannot exceed 175 under any circumstance."' },
      { id: 'minimum', label: 'Is there a minimum guest count or spend?', required: true, helpText: 'If there is no minimum, write "No minimum."', placeholder: 'e.g., "No minimum." or "50-guest minimum on Saturdays."' },
      { id: 'capacity_varies', label: 'Does capacity change by space or time of year?', required: false, helpText: 'If your capacity is the same year-round in every space, write "Same throughout."', placeholder: 'e.g., "The garden holds 150; the indoor hall only 90, so winter dates cap at 90."' }
    ]
  },
  {
    topic: 'alcohol_bar',
    title: 'Bar & Alcohol',
    description: 'Brides ask about this constantly, and getting it wrong is expensive.',
    estimatedMinutes: 4,
    questions: [
      { id: 'alcohol_model', label: 'How does alcohol work at your venue?', required: true, helpText: 'You provide it? They bring their own? A licensed outside bartender? Be specific.', placeholder: 'e.g., "We provide all alcohol through our bar packages. Outside alcohol is not permitted."' },
      { id: 'bar_options', label: 'What bar options and prices do you offer?', required: true, helpText: 'List each tier with its price. If you do not sell alcohol at all, write "We do not provide alcohol."', placeholder: 'e.g., "Beer & wine $22/person. Full open bar $45/person. Both include bartenders."' },
      { id: 'alcohol_included', label: 'Is alcohol included in any of your prices?', required: true, helpText: 'Usually the answer is no. Say so plainly — this is the single most common misunderstanding.', placeholder: 'e.g., "Alcohol is never included. A bar package is always a separate per-person cost."' },
      { id: 'bar_hours', label: 'When does the bar open and close?', required: true, helpText: 'If it depends on their event window, explain the rule rather than a fixed time.', placeholder: 'e.g., "Opens after the ceremony, closes one hour before the reception ends, last call 15 minutes before."' },
      { id: 'bar_rules', label: 'Any alcohol rules or restrictions?', required: false, helpText: 'Shots, corkage, self-service, cash bars, dry weddings. If none, write "No additional rules."', placeholder: 'e.g., "No shots served. Cash bars are not permitted."' }
    ]
  },
  {
    topic: 'catering',
    title: 'Catering & Food',
    description: 'How food works, what it costs, and who is allowed to cook it.',
    estimatedMinutes: 4,
    questions: [
      { id: 'catering_model', label: 'How does catering work?', required: true, helpText: 'In-house only? Outside caterers welcome? A required list? Say which.', placeholder: 'e.g., "In-house catering only." or "Outside caterers welcome if licensed and insured."' },
      { id: 'food_cost', label: 'What does food cost per person?', required: true, helpText: 'Give a real range and say what service styles it covers. If food is not through you, say how a couple gets a number.', placeholder: 'e.g., "$45-70 per person buffet, $80-120 plated, tax and service included."' },
      { id: 'outside_food_rules', label: 'What food are couples NOT allowed to bring?', required: true, helpText: 'Home cooking, potlucks, outside desserts, food trucks. If anything goes, write "No restrictions."', placeholder: 'e.g., "A friend or family member cooking is not permitted, for liability. Outside desserts are fine."' },
      { id: 'dietary', label: 'Can you accommodate dietary needs?', required: false, helpText: 'Gluten-free, vegan, allergies, kids meals. If you do not handle food, write "Handled by their caterer."', placeholder: 'e.g., "Yes — gluten-free, vegan, and allergy accommodations with advance notice."' },
      { id: 'tasting', label: 'Is there a tasting, and when does menu planning happen?', required: false, helpText: 'If not applicable, write "Not applicable."', placeholder: 'e.g., "Tastings are held after booking, at your first planning meeting."' }
    ]
  },
  {
    topic: 'ceremony_spaces',
    title: 'Ceremony Spaces',
    description: 'Where the vows happen, and what happens if it rains.',
    estimatedMinutes: 3,
    questions: [
      { id: 'ceremony_options', label: 'Where can a couple hold their ceremony?', required: true, helpText: 'Name each spot and describe it briefly. Say whether each is indoor or outdoor.', placeholder: 'e.g., "Lakeside lawn (outdoor, seats 150) or the stone chapel (indoor, seats 100)."' },
      { id: 'rain_plan', label: 'What is the rain plan?', required: true, helpText: 'Brides ask this every time. Be specific about what the backup actually is.', placeholder: 'e.g., "The hall converts for indoor ceremonies. Decision is made 24 hours ahead with your coordinator."' },
      { id: 'ceremony_included', label: 'What comes with the ceremony space?', required: true, helpText: 'Chairs, arch, sound, rehearsal. Say what a couple must rent separately.', placeholder: 'e.g., "White chairs, a wooden arch, and a sound system. Florals for the arch are separate."' },
      { id: 'ceremony_restrictions', label: 'Any ceremony restrictions?', required: false, helpText: 'Seasonal closures, time limits, noise rules. If none, write "No restrictions."', placeholder: 'e.g., "The lakeside lawn is unavailable December through March."' }
    ]
  },
  {
    topic: 'reception_spaces',
    title: 'Reception Spaces',
    description: 'Where dinner and dancing happen.',
    estimatedMinutes: 3,
    questions: [
      { id: 'reception_options', label: 'Where can a couple hold their reception?', required: true, helpText: 'Name each space, describe it, give its capacity.', placeholder: 'e.g., "The barn — exposed beams, string lights, holds 150 seated."' },
      { id: 'space_combinations', label: 'Can spaces be mixed and matched?', required: true, helpText: 'Couples ask about combinations constantly. Say which pairings are allowed and which are not.', placeholder: 'e.g., "Any ceremony site works with either reception space. The tent cannot be used for dinner."' },
      { id: 'reception_seasonal', label: 'Is any reception space unavailable part of the year?', required: true, helpText: 'If everything is available year-round, write "All spaces available year-round."', placeholder: 'e.g., "The tent is only up May through October. Off-season receptions use the indoor hall."' },
      { id: 'reception_extras', label: 'Does any reception space cost extra?', required: false, helpText: 'If all are included in your base price, write "All included."', placeholder: 'e.g., "Full tent setup is a $1,200 add-on, or included with the all-inclusive package."' }
    ]
  },
  {
    topic: 'getting_ready',
    title: 'Getting Ready & Other Spaces',
    description: 'Where the couple prepares, and everywhere else on the property.',
    estimatedMinutes: 3,
    questions: [
      { id: 'getting_ready_spaces', label: 'Where does the couple get ready?', required: true, helpText: 'Bridal suite, groom\'s lounge, or both. Describe each. If you have no dedicated space, say so plainly.', placeholder: 'e.g., "Bridal suite with makeup stations for six and a private bath. Separate groom\'s lounge with a pool table and TV."' },
      { id: 'getting_ready_access', label: 'When can they access those spaces, and how many people fit?', required: true, helpText: 'Start time and comfortable headcount for each.', placeholder: 'e.g., "Suites open at 10am. Bridal suite fits 8 comfortably, groom\'s lounge 6."' },
      { id: 'other_spaces', label: 'What other spaces are on the property?', required: true, helpText: 'Courtyard, patio, cocktail area, lounge, fire pit, lawn games area. Anything a couple would use or ask about. If there are none, write "No other spaces."', placeholder: 'e.g., "A brick courtyard for cocktail hour, a covered patio, and a fire pit by the treeline."' },
      { id: 'photo_spots', label: 'What spots do photographers love?', required: false, helpText: 'If nothing specific comes to mind, write "No particular spots."', placeholder: 'e.g., "The willow by the water, the rose garden, and the sunset overlook."' }
    ]
  },
  {
    topic: 'amenities',
    title: "What's Included",
    description: 'Everything a couple gets without paying extra.',
    estimatedMinutes: 4,
    questions: [
      { id: 'included_items', label: "What's included with booking your venue?", required: true, helpText: 'Furniture, linens, lighting, staff, parking, equipment. Be thorough — this list sells the venue.', placeholder: 'e.g., "Tables, chairs, white linens, string lights, sound system, setup and teardown, parking for 100."' },
      { id: 'access_hours', label: 'How much time do they get on site?', required: true, helpText: 'Total access hours, and how much of that is the event itself. Include setup and cleanup.', placeholder: 'e.g., "12 hours of access with a 6-hour event window. Setup starts at 10am, everyone out by midnight."' },
      { id: 'not_included_amenities', label: 'What do couples assume is included but is NOT?', required: true, helpText: 'The mismatch that causes the most frustration. Think about what you get asked to clarify most.', placeholder: 'e.g., "Linens beyond white, chargers, draping, and a dance floor are all rentals."' },
      { id: 'accessibility', label: 'Is the venue wheelchair accessible?', required: true, helpText: 'Note any part of the property that is not.', placeholder: 'e.g., "Fully accessible except the loft, which is stairs-only."' },
      { id: 'parking', label: 'What is the parking situation?', required: false, helpText: 'How many cars, free or paid, overflow, shuttles.', placeholder: 'e.g., "Free on-site parking for 100 cars. Overflow field for another 50."' }
    ]
  },
  {
    topic: 'rules_policies',
    title: 'Rules & Restrictions',
    description: 'What is and is not allowed on your property.',
    estimatedMinutes: 4,
    questions: [
      { id: 'end_time', label: 'What time does music stop and everyone leave?', required: true, helpText: 'Include any noise ordinance that drives it.', placeholder: 'e.g., "Music ends at 11pm due to a local noise ordinance. Guests out by 11:30."' },
      { id: 'decor_rules', label: 'What decor is not allowed?', required: true, helpText: 'Candles, sparklers, confetti, fireworks, nails or tape on walls, hanging things. If anything goes, say so.', placeholder: 'e.g., "Open flame must be enclosed. No confetti or glitter. Sparklers outdoors only. No fireworks."' },
      { id: 'setup_teardown', label: 'Who sets up and tears down?', required: true, helpText: 'Include what happens to their decor at the end of the night.', placeholder: 'e.g., "We handle tables and chairs. Couples set up and remove their own decor the same night."' },
      { id: 'pets', label: 'Are pets allowed?', required: true, helpText: 'If yes, note any conditions and where they can and cannot be. If no, just say no.', placeholder: 'e.g., "Dogs welcome for the ceremony and photos, but not the reception since food is out."' },
      { id: 'other_events', label: 'Do you host anything other than weddings?', required: true, helpText: 'Corporate events, showers, celebrations of life, parties. If you only do weddings, say so — and say who to contact if someone asks anyway.', placeholder: 'e.g., "We host corporate events and showers too — those go to our events manager for a custom quote."' },
      { id: 'smoking', label: 'Smoking policy, and anything else brides should know?', required: false, helpText: 'Anything not covered above. If nothing, write "Nothing else."', placeholder: 'e.g., "Smoking in the designated patio area only."' }
    ]
  },
  {
    topic: 'payment_deposits',
    title: 'Deposits & Payment',
    description: 'What it takes to hold a date and how they pay the rest.',
    estimatedMinutes: 3,
    questions: [
      { id: 'deposit', label: 'What is due to book a date?', required: true, helpText: 'Give the amount or percentage, and say whether it is refundable.', placeholder: 'e.g., "$2,500 non-refundable deposit plus a signed contract holds your date."' },
      { id: 'payment_schedule', label: 'When is the rest due?', required: true, helpText: 'Walk through the schedule from booking to the final payment.', placeholder: 'e.g., "50% by six months out, balance due 30 days before the wedding."' },
      { id: 'payment_methods', label: 'How can they pay, and are there fees?', required: true, helpText: 'Cards, check, transfer, payment plans, processing fees.', placeholder: 'e.g., "Check or card. Cards carry a 3% processing fee. Monthly payment plans available."' },
      { id: 'cancellation', label: 'What is your cancellation and rescheduling policy?', required: true, helpText: 'What they lose, what transfers, what happens if they move the date.', placeholder: 'e.g., "Deposit is non-refundable. Payments made are transferable to a new date within 12 months, once."' },
      { id: 'hold_policy', label: 'Can you hold a date without a deposit?', required: false, helpText: 'If not, write "Dates are held only with a signed contract and deposit."', placeholder: 'e.g., "We can courtesy-hold a date for 7 days."' }
    ]
  },
  {
    topic: 'vendors',
    title: 'Outside Vendors',
    description: 'Who couples can bring in, and who they cannot.',
    estimatedMinutes: 3,
    questions: [
      { id: 'vendor_policy', label: 'Can couples bring their own vendors?', required: true, helpText: 'Say which categories are open and which are exclusive to you.', placeholder: 'e.g., "Photographer, florist, and DJ are their choice. Catering and bar must be through us."' },
      { id: 'vendor_requirements', label: 'What do outside vendors have to provide?', required: true, helpText: 'Insurance, licensing, load-in times, anything you require in advance.', placeholder: 'e.g., "Proof of liability insurance two weeks out. Load-in starts three hours before the event."' },
      { id: 'preferred_list', label: 'Do you have a preferred vendor list?', required: true, helpText: 'Say whether using it is required, discounted, or just a recommendation. If you have no list, say so.', placeholder: 'e.g., "We have a preferred list. Using an off-list caterer adds a $5 per-guest fee."' },
      { id: 'coordinator_required', label: 'Do you require a planner or day-of coordinator?', required: true, helpText: 'If required, say whether you provide one or they must hire one.', placeholder: 'e.g., "A day-of coordinator is required. Ours is included in the all-inclusive package, or you can bring your own."' }
    ]
  },
  {
    topic: 'lodging',
    title: 'Lodging & Overnight',
    description: 'Where the couple and guests sleep.',
    estimatedMinutes: 3,
    questions: [
      { id: 'onsite_lodging', label: 'Do you have on-site lodging?', required: true, helpText: 'If you have none, write "No on-site lodging." That is a complete answer and an important one.', placeholder: 'e.g., "Four cabins sleeping 24 total, plus a private cottage for the couple."' },
      { id: 'lodging_cost', label: 'What does lodging cost, and is any of it included?', required: true, helpText: 'Say what is included with which booking option and what is a paid add-on. If you have no lodging, write "Not applicable."', placeholder: 'e.g., "Cottage included with the all-inclusive package. Cabins are $1,800 for the night, never included."' },
      { id: 'lodging_availability', label: 'Is lodging available year-round, and for how many nights?', required: false, helpText: 'If not applicable, write "Not applicable."', placeholder: 'e.g., "One night only, May through October. Multi-night stays are handled case by case."' },
      { id: 'nearby_hotels', label: 'What are the nearest hotels?', required: true, helpText: 'Name a couple and give rough drive time. Note any room blocks you arrange.', placeholder: 'e.g., "Two hotels within 10 minutes in town. We can help set up a room block."' }
    ]
  },
  {
    topic: 'availability_dates',
    title: 'Dates & Seasons',
    description: 'The narrative side of your calendar. The month-by-month grid is a separate step.',
    estimatedMinutes: 3,
    questions: [
      { id: 'booking_window', label: 'How far in advance do couples typically book?', required: true, helpText: 'Give a realistic range and note which dates go fastest.', placeholder: 'e.g., "Most book 12-18 months out. Fall Saturdays go first, often two years ahead."' },
      { id: 'season_character', label: 'What is each season like at your venue?', required: true, helpText: 'Help a bride picture the difference. Mention weather, light, what is in bloom or changing.', placeholder: 'e.g., "May and June are lush and green. October brings peak color. Winter is intimate and indoor."' },
      { id: 'blocked_dates', label: 'Are there dates you never book?', required: true, helpText: 'Holidays, closures, private events. If you book any date, write "No blocked dates."', placeholder: 'e.g., "We do not host on Thanksgiving, Christmas Eve, Christmas, or New Year\'s Eve."' },
      { id: 'multiple_events', label: 'Do you host more than one wedding at a time?', required: true, helpText: 'Couples want to know if they have the property to themselves.', placeholder: 'e.g., "One wedding per day. The property is entirely yours."' }
    ]
  }
];

export default ONBOARDING_STEPS;