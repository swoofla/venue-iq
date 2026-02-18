const ONBOARDING_SECTIONS = [
  {
    id: 'spaces',
    title: 'Your Spaces & Amenities',
    description: 'Help brides picture your venue by describing your spaces.',
    icon: 'Building2',
    category: 'amenities',
    estimatedMinutes: 4,
    questions: [
      {
        id: 'ceremony_spaces',
        label: 'Ceremony Spaces',
        type: 'textarea',
        placeholder: 'e.g., "We have a beautiful outdoor lakeside ceremony area with mature oak trees, a natural grass aisle, and mountain backdrop. We also have an indoor chapel that seats 150."',
        helpText: 'Describe each ceremony option you offer — indoor, outdoor, or both.',
        required: true
      },
      {
        id: 'reception_spaces',
        label: 'Reception Spaces',
        type: 'textarea',
        placeholder: 'e.g., "Our main reception hall is a restored barn with exposed beams, string lights, and floor-to-ceiling windows overlooking the lake. Capacity for up to 200 guests."',
        helpText: 'Describe your reception area(s) — size, style, capacity, key features.',
        required: true
      },
      {
        id: 'bridal_suite',
        label: 'Bridal Suite / Getting Ready Space',
        type: 'textarea',
        placeholder: 'e.g., "Our bridal suite has a full-length mirror, makeup stations for up to 6, a private bathroom, and a mini fridge stocked with water and champagne."',
        helpText: 'If you have one, describe it. If not, just write "Not available."',
        required: false
      },
      {
        id: 'groom_room',
        label: "Groom's Room / Second Getting Ready Space",
        type: 'textarea',
        placeholder: 'e.g., "We have a separate groom\'s lounge with a pool table, flat screen TV, and private bar area."',
        helpText: 'Describe the groom\'s space, or write "Not available."',
        required: false
      },
      {
        id: 'included_amenities',
        label: "What's Included with the Venue Rental",
        type: 'textarea',
        placeholder: 'e.g., "Tables (round and rectangular), chiavari chairs, white linens, string lights, basic sound system, setup and breakdown crew, day-of venue coordinator, parking for 100 cars."',
        helpText: 'List everything couples get when they book your venue — furniture, lighting, equipment, staff, etc.',
        required: true
      },
      {
        id: 'photo_spots',
        label: 'Photo Opportunities',
        type: 'textarea',
        placeholder: 'e.g., "Our property has a willow tree by the lake, a rose garden, a rustic barn doorway, and a sunset overlook that photographers love."',
        helpText: 'What spots on your property do photographers love?',
        required: false
      },
      {
        id: 'restrooms',
        label: 'Restroom Facilities',
        type: 'textarea',
        placeholder: 'e.g., "Indoor restrooms in the main building with 4 stalls for women and 2 for men. We also have a luxury restroom trailer available for outdoor events."',
        helpText: 'How many restrooms, indoor/outdoor, any luxury trailer options?',
        required: false
      }
    ]
  },
  {
    id: 'policies',
    title: 'Policies & Logistics',
    description: 'These are the #1 questions brides ask. Clear policies = fewer emails for you.',
    icon: 'FileText',
    category: 'policy',
    estimatedMinutes: 5,
    questions: [
      {
        id: 'booking_deposit',
        label: 'Deposit & Payment Schedule',
        type: 'textarea',
        placeholder: 'e.g., "We require a $2,500 non-refundable deposit to secure your date. The remaining balance is split: 50% due 90 days before, final 50% due 30 days before the wedding."',
        helpText: 'How much is the deposit? When are remaining payments due?',
        required: true
      },
      {
        id: 'cancellation_policy',
        label: 'Cancellation & Refund Policy',
        type: 'textarea',
        placeholder: 'e.g., "The deposit is non-refundable. Cancellations 6+ months out receive a 50% refund of payments made beyond the deposit. Within 6 months, no refunds. Date transfers available for a $500 fee."',
        helpText: 'What happens if a couple needs to cancel or reschedule?',
        required: true
      },
      {
        id: 'event_times',
        label: 'Event Hours / Start & End Times',
        type: 'textarea',
        placeholder: 'e.g., "Venue access begins at 10 AM for setup. Ceremonies typically start between 3-5 PM. Music must end by 10 PM, and all guests must depart by 11 PM."',
        helpText: 'When can couples access the venue? When does music stop? When must guests leave?',
        required: true
      },
      {
        id: 'alcohol_policy',
        label: 'Alcohol Policy',
        type: 'textarea',
        placeholder: 'e.g., "We have a full bar with licensed bartenders. BYOB is allowed for beer and wine with a $5/person corkage fee. All events must use our insured bartender staff."',
        helpText: 'BYOB allowed? Licensed bar? Corkage fees? Bartender requirements?',
        required: true
      },
      {
        id: 'vendor_policy',
        label: 'Outside Vendors',
        type: 'textarea',
        placeholder: 'e.g., "We have a preferred vendor list but couples are welcome to bring outside vendors. All vendors must provide proof of insurance."',
        helpText: 'Can couples bring their own vendors? Is there a preferred list?',
        required: true
      },
      {
        id: 'decor_restrictions',
        label: 'Décor Rules & Restrictions',
        type: 'textarea',
        placeholder: 'e.g., "No open flames (LED candles are fine), no confetti or glitter, no nailing or taping to walls. Sparklers allowed outdoors only."',
        helpText: 'Any restrictions on candles, confetti, wall attachments, sparklers, etc.?',
        required: false
      },
      {
        id: 'rain_plan',
        label: 'Rain / Weather Backup Plan',
        type: 'textarea',
        placeholder: 'e.g., "Our indoor reception hall serves as rain backup for outdoor ceremonies. We monitor weather 48 hours out and work with you to make the call."',
        helpText: 'What happens if it rains? Indoor backup? Tent options?',
        required: true
      },
      {
        id: 'parking',
        label: 'Parking',
        type: 'textarea',
        placeholder: 'e.g., "Free on-site parking for up to 100 cars. Overflow parking available in the adjacent field."',
        helpText: 'How many cars can park? Is it free? Overflow options?',
        required: true
      }
    ]
  },
  {
    id: 'faq',
    title: 'Common Questions',
    description: 'Brides ask these all the time. Your answers here save you hours of emails.',
    icon: 'HelpCircle',
    category: 'faq',
    estimatedMinutes: 3,
    questions: [
      {
        id: 'booking_advance',
        label: 'How Far in Advance Should Couples Book?',
        type: 'textarea',
        placeholder: 'e.g., "We recommend booking 12-18 months in advance for Saturday dates. Weekday and Sunday weddings can often be booked 6-9 months out."',
        helpText: 'What do you typically recommend?',
        required: true
      },
      {
        id: 'accessibility',
        label: 'Accessibility',
        type: 'textarea',
        placeholder: 'e.g., "Our reception hall and indoor restrooms are fully ADA accessible. The outdoor ceremony area has a paved path for wheelchair access."',
        helpText: 'Is your venue wheelchair accessible? Any limitations?',
        required: true
      },
      {
        id: 'pets',
        label: 'Pet Policy',
        type: 'textarea',
        placeholder: 'e.g., "Well-behaved dogs are welcome at outdoor ceremonies! We ask that a designated pet handler be responsible for the pet."',
        helpText: 'Are dogs/pets allowed? Any restrictions?',
        required: false
      },
      {
        id: 'rehearsal_dinner',
        label: 'Rehearsal Dinner Options',
        type: 'textarea',
        placeholder: 'e.g., "We offer the venue for rehearsal dinners the evening before your wedding at a reduced rate."',
        helpText: 'Can couples host their rehearsal dinner at your venue?',
        required: false
      },
      {
        id: 'nearby_accommodations',
        label: 'Nearby Hotels & Accommodations',
        type: 'textarea',
        placeholder: 'e.g., "We partner with the Lakeside Inn (5 min away) for a room block discount. Other options: Holiday Inn Express (10 min), The Grand Hotel (15 min)."',
        helpText: 'Where can out-of-town guests stay? Any partnerships or on-site lodging?',
        required: true
      },
      {
        id: 'typical_timeline',
        label: 'Typical Wedding Day Timeline',
        type: 'textarea',
        placeholder: 'e.g., "10 AM: Vendor setup. 1 PM: Bridal party arrives. 4 PM: Ceremony. 4:30 PM: Cocktail hour. 5:30 PM: Reception. 9:30 PM: Last dance. 10 PM: Music ends."',
        helpText: 'Walk through what a typical wedding day looks like at your venue.',
        required: false
      }
    ]
  },
  {
    id: 'personality',
    title: "Your Venue's Personality",
    description: "This helps your chatbot speak authentically about your venue — not generic fluff.",
    icon: 'Sparkles',
    category: 'other',
    estimatedMinutes: 3,
    questions: [
      {
        id: 'venue_vibe',
        label: "How Would You Describe Your Venue's Vibe?",
        type: 'textarea',
        placeholder: 'e.g., "Rustic elegance meets lakeside charm. We\'re not a cookie-cutter ballroom — we\'re for couples who want their wedding to feel warm, personal, and connected to nature."',
        helpText: 'In 2-3 sentences, capture what makes your venue feel special.',
        required: true
      },
      {
        id: 'differentiator',
        label: 'What Makes You Different from Other Venues?',
        type: 'textarea',
        placeholder: 'e.g., "We\'re the only lakefront venue in the area with both indoor and outdoor options. Our all-inclusive packages mean couples don\'t have to juggle 10 different vendors."',
        helpText: 'What do you say when someone asks why they should choose you?',
        required: true
      },
      {
        id: 'couples_love',
        label: 'What Do Couples Say They Love Most?',
        type: 'textarea',
        placeholder: 'e.g., "Couples always mention three things: the sunset ceremony views, how easy we make planning, and the fact that guests rave about the food for months."',
        helpText: 'Think about your best reviews and testimonials — what themes come up?',
        required: false
      },
      {
        id: 'ideal_couple',
        label: 'Who Is Your Ideal Couple?',
        type: 'textarea',
        placeholder: 'e.g., "We\'re perfect for couples who want a relaxed, nature-filled wedding without sacrificing elegance. Our sweet spot is 80-150 guests."',
        helpText: 'This helps the chatbot understand who your venue is the best fit for.',
        required: false
      }
    ]
  }
];

export function calculateReadinessScore(onboardingProgress, hasPackages, hasPricing, hasVenueBasics) {
  let score = 0;

  // Auto-detected (40%)
  if (hasVenueBasics) score += 10;
  if (hasPackages) score += 15;
  if (hasPricing) score += 15;

  // Questionnaire sections (55%)
  const sectionWeights = {
    section_spaces: 15,
    section_policies: 15,
    section_faq: 15,
    section_personality: 10
  };

  if (onboardingProgress) {
    for (const [section, weight] of Object.entries(sectionWeights)) {
      if (onboardingProgress[section] === 'complete' || onboardingProgress[section] === 'auto_complete') {
        score += weight;
      } else if (onboardingProgress[section] === 'in_progress') {
        score += Math.round(weight * 0.3);
      }
    }
    // Bonus: Transcript upload (5%)
    if (onboardingProgress.section_transcripts === 'complete') {
      score += 5;
    }
  }

  return Math.min(score, 100);
}

export { ONBOARDING_SECTIONS, calculateReadinessScore };
export default ONBOARDING_SECTIONS;