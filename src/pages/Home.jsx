import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Phone } from 'lucide-react';
import { createPageUrl } from '../utils';

import ChatMessage from '@/components/chat/ChatMessage';
import TypingIndicator from '@/components/chat/TypingIndicator';
import QuickActions from '@/components/chat/QuickActions';
import ChatInput from '@/components/chat/ChatInput';
import EnhancedBudgetCalculator from '@/components/flows/EnhancedBudgetCalculator';
import AvailabilityChecker from '@/components/flows/AvailabilityChecker';
import TourScheduler from '@/components/flows/TourScheduler';
import PackagesView from '@/components/flows/PackagesView';
import VideoAskPanel from '@/components/VideoAskPanel';

const getWelcomeMessage = (venueName) => `Welcome to ${venueName}, we're glad to have you. How can we help you envision your perfect day here?`;

export default function Home() {
  const [user, setUser] = useState(null);
  const [venueId, setVenueId] = useState(null);
  const [venueName, setVenueName] = useState('Sugar Lake Weddings');
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([
    { id: 1, text: getWelcomeMessage('Sugar Lake Weddings'), isBot: true }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [activeFlow, setActiveFlow] = useState(null);
  const [preSelectedDate, setPreSelectedDate] = useState('');
  const [awaitingPlannerContact, setAwaitingPlannerContact] = useState(false);
  const [originalQuestion, setOriginalQuestion] = useState('');
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    base44.entities.Venue.list().then(venues => {
      const sugarLakeVenue = venues.find(v => v.name.toLowerCase().includes('sugar lake')) || venues[0];
      if (sugarLakeVenue) {
        setVenueId(sugarLakeVenue.id);
        setVenueName(sugarLakeVenue.name);
        setMessages([{ id: 1, text: getWelcomeMessage(sugarLakeVenue.name), isBot: true }]);
      }
    });

    base44.auth.isAuthenticated().then(isAuth => {
      if (isAuth) {
        base44.auth.me().then(u => {
          setUser(u);
          // Users with venue assignments go to Dashboard
          if (u.venue_id) {
            window.location.href = createPageUrl('Dashboard');
            return;
          }
          // Super admins and users without venue can access chatbot
          else {
            setLoading(false);
          }
        });
      } else {
        setLoading(false);
      }
    });
  }, []);

  const { data: bookedDates = [] } = useQuery({
    queryKey: ['bookedDates'],
    queryFn: () => base44.entities.BookedWeddingDate.list(),
  });

  const { data: venueKnowledge = [] } = useQuery({
    queryKey: ['venueKnowledge'],
    queryFn: () => base44.entities.VenueKnowledge.filter({ is_active: true }),
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeFlow]);

  const addBotMessage = (text) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { id: Date.now(), text, isBot: true }]);
      setIsTyping(false);
    }, 1000);
  };

  const handleUserMessage = async (text) => {
    setMessages(prev => [...prev, { id: Date.now(), text, isBot: false }]);
    
    const lowerText = text.toLowerCase();

    if (awaitingPlannerContact) {
      if (lowerText.includes('yes')) {
        addBotMessage("Great! What's your full name and phone number so a planner can reach out to you?");
        setAwaitingPlannerContact('collect_details');
      } else if (lowerText.includes('no')) {
        addBotMessage("No problem! Let me know if there's anything else I can help with.");
        setAwaitingPlannerContact(false);
        setOriginalQuestion('');
        setLeadName('');
        setLeadPhone('');
      } else {
        addBotMessage("Please respond with 'yes' or 'no'.");
      }
      return;
    }

    if (awaitingPlannerContact === 'collect_details') {
      const phoneMatch = lowerText.match(/(\d[\d\s\-]+)/);
      let currentName = leadName;
      let currentPhone = leadPhone;
      let email = user?.email || undefined;

      if (!currentName && text.length > 5 && !phoneMatch) {
        currentName = text.trim();
        setLeadName(currentName);
      }

      if (phoneMatch && phoneMatch[1]) {
        currentPhone = phoneMatch[1].replace(/\s|-/g, '');
        setLeadPhone(currentPhone);
      }

      if (currentName && currentPhone) {
        addBotMessage("Thank you! I'm sending your request to the Sugar Lake planners now.");
        
        try {
          await base44.functions.invoke('createHighLevelLeadAndNotify', {
            name: currentName,
            phone: currentPhone,
            email: email,
            question: originalQuestion
          });
          addBotMessage("Your information has been sent! A planner will be in touch shortly.");
        } catch (error) {
          console.error("Failed to send lead to HighLevel:", error);
          addBotMessage("I had trouble sending your information. Please try again or contact us directly at (216) 616-1598.");
        }

        setAwaitingPlannerContact(false);
        setOriginalQuestion('');
        setLeadName('');
        setLeadPhone('');
      } else {
        addBotMessage("Please tell me your full name and phone number. For example: 'My name is John Doe and my number is 123-456-7890'.");
      }
      return;
    }
    
    if (lowerText.includes('budget') || lowerText.includes('cost') || lowerText.includes('price')) {
      addBotMessage("Great question! Let me help you figure out the perfect package for your budget. I'll walk you through our budget calculator.");
      setTimeout(() => setActiveFlow('budget'), 1500);
    } else if (lowerText.includes('available') || lowerText.includes('date') || lowerText.includes('book')) {
      addBotMessage("Let's check if your desired date is available! Please select a date below.");
      setTimeout(() => setActiveFlow('availability'), 1500);
    } else if (lowerText.includes('tour') || lowerText.includes('visit') || lowerText.includes('see')) {
      addBotMessage("We'd love to show you around Sugar Lake! Let's schedule a tour that works for you.");
      setTimeout(() => setActiveFlow('tour'), 1500);
    } else if (lowerText.includes('package') || lowerText.includes('option')) {
      addBotMessage("We have three beautiful packages designed to fit different wedding styles and sizes. Take a look:");
      setTimeout(() => setActiveFlow('packages'), 1500);
    } else {
      // Check knowledge base for relevant answer
      const relevantKnowledge = venueKnowledge.find(k => 
        lowerText.includes(k.question.toLowerCase()) || 
        k.question.toLowerCase().includes(lowerText)
      );

      if (relevantKnowledge) {
        addBotMessage(relevantKnowledge.answer);
      } else {
        // Use AI to provide intelligent response with context
        setIsTyping(true);
        try {
          const knowledgeContext = venueKnowledge.map(k => `Q: ${k.question}\nA: ${k.answer}`).join('\n\n');
          
          const response = await base44.integrations.Core.InvokeLLM({
            prompt: `You are a helpful wedding venue chatbot assistant for Sugar Lake. Answer the user's question ONLY using the provided "Venue Knowledge Base". Do NOT make up answers.
            If you CANNOT answer the question confidently and completely using ONLY the provided knowledge base, then respond with exactly "OUT_OF_SCOPE".
            
            Venue Knowledge Base:
            ${knowledgeContext}
            
            User Question: ${text}
            
            Provide a warm, professional response.`,
          });
          
          if (response === "OUT_OF_SCOPE") {
            setOriginalQuestion(text);
            addBotMessage("This question would be better to ask one of the planners at Sugar Lake, should I put you in touch with one of them now?");
            setAwaitingPlannerContact(true);
          } else {
            setMessages(prev => [...prev, { id: Date.now(), text: response, isBot: true }]);
          }
        } catch (error) {
          setMessages(prev => [...prev, { id: Date.now(), text: "Thank you for reaching out! I can help you with budget planning, checking date availability, scheduling a tour, or exploring our packages. What would you like to know more about?", isBot: true }]);
        }
        setIsTyping(false);
        return;
      }
    }
  };

  const handleQuickAction = (action) => {
    switch (action) {
      case 'budget':
        setMessages(prev => [...prev, { id: Date.now(), text: "I'd like to use the budget calculator", isBot: false }]);
        addBotMessage("Perfect! Let's find the ideal package for your budget. I'll guide you through a few questions.");
        setTimeout(() => setActiveFlow('budget'), 1500);
        break;
      case 'availability':
        setMessages(prev => [...prev, { id: Date.now(), text: "I want to check date availability", isBot: false }]);
        addBotMessage("Let's see if your dream date is available! Please select a date below.");
        setTimeout(() => setActiveFlow('availability'), 1500);
        break;
      case 'tour':
        setMessages(prev => [...prev, { id: Date.now(), text: "I'd like to schedule a tour", isBot: false }]);
        addBotMessage("We'd love to welcome you to Sugar Lake! Let's find a time that works for you.");
        setTimeout(() => setActiveFlow('tour'), 1500);
        break;
      case 'packages':
        setMessages(prev => [...prev, { id: Date.now(), text: "Show me your packages", isBot: false }]);
        addBotMessage("Here are our three beautiful packages, each designed to create an unforgettable celebration:");
        setTimeout(() => setActiveFlow('packages'), 1500);
        break;
    }
  };

  const handleBudgetComplete = async (data) => {
    const venues = await base44.entities.Venue.list();
    const sugarLakeVenue = venues.find(v => v.name.toLowerCase().includes('sugar lake')) || venues[0];
    
    const submissionData = {
      ...data,
      source: 'budget_calculator',
      name: 'Budget Calculator User',
      email: 'pending@sugar-lake.com',
      venue_id: sugarLakeVenue?.id,
    };
    
    await base44.entities.ContactSubmission.create(submissionData);
    
    setActiveFlow(null);
    addBotMessage(`Based on your budget of $${data.budget.toLocaleString()} and ${data.guestCount} guests, I recommend our ${data.recommendedPackage} package. Would you like to schedule a tour to see the space in person?`);
  };

  const handleAvailabilityTour = (date) => {
    setPreSelectedDate(date);
    setActiveFlow('tour');
  };

  const handleTourComplete = async (data) => {
    const venues = await base44.entities.Venue.list();
    const sugarLakeVenue = venues.find(v => v.name.toLowerCase().includes('sugar lake')) || venues[0];

    const submissionData = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      wedding_date: data.weddingDate,
      guest_count: parseInt(data.guestCount) || null,
      tour_date: data.tourDate,
      tour_time: data.tourTime,
      source: 'tour_scheduler',
      venue_id: sugarLakeVenue?.id,
    };

    // Save to Base44 database
    await base44.entities.ContactSubmission.create(submissionData);

    // Sync to HighLevel
    try {
      const contactRes = await base44.functions.invoke('createHighLevelContact', {
        email: data.email,
        name: data.name,
        phone: data.phone,
        wedding_date: data.weddingDate,
        guest_count: data.guestCount,
        source: 'tour_scheduler'
      });
      console.log('Contact created:', contactRes.data);

      const appointmentRes = await base44.functions.invoke('createHighLevelAppointment', {
        email: data.email,
        name: data.name,
        phone: data.phone,
        tour_date: data.tourDate,
        tour_time: data.tourTime,
        wedding_date: data.weddingDate,
        guest_count: data.guestCount
      });
      console.log('Appointment created:', appointmentRes.data);
    } catch (error) {
      console.error('HighLevel sync error:', error.response?.data || error.message);
    }
  };

  const handlePackageTour = (packageName) => {
    setActiveFlow('tour');
    addBotMessage(`Excellent choice! The ${packageName} package is one of our favorites. Let's schedule a tour so you can see everything in person.`);
  };

  const closeFlow = () => {
    setActiveFlow(null);
    setPreSelectedDate('');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Header */}
      <header className="bg-black text-white px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-light tracking-wide">{venueName}</h1>
          <p className="text-xs tracking-[0.3em] text-stone-400 mt-0.5">VIRTUAL PLANNER</p>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col max-w-4xl w-full mx-auto bg-white shadow-sm">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 pb-4">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message.text}
              isBot={message.isBot}
            />
          ))}
          
          {isTyping && <TypingIndicator />}

          {/* Active Flow Components */}
          {activeFlow === 'budget' && (
            <BudgetCalculator
              onComplete={handleBudgetComplete}
              onCancel={closeFlow}
            />
          )}
          
          {activeFlow === 'availability' && (
            <AvailabilityChecker
              bookedDates={bookedDates}
              onScheduleTour={handleAvailabilityTour}
              onCancel={closeFlow}
            />
          )}
          
          {activeFlow === 'tour' && (
            <TourScheduler
              preSelectedDate={preSelectedDate}
              onComplete={handleTourComplete}
              onCancel={closeFlow}
            />
          )}
          
          {activeFlow === 'packages' && (
            <PackagesView
              onScheduleTour={handlePackageTour}
              onCancel={closeFlow}
            />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        <QuickActions
          onAction={handleQuickAction}
          disabled={isTyping || activeFlow !== null}
        />

        {/* Chat Input */}
        <ChatInput
          onSend={handleUserMessage}
          disabled={isTyping || activeFlow !== null}
          placeholder="Type your message..."
        />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center text-sm text-stone-500">
          <span className="font-light">since 2017</span>
          <a
            href="tel:+12166161598"
            className="flex items-center gap-2 text-stone-700 hover:text-black transition-colors"
          >
            <Phone className="w-4 h-4" />
            (216) 616-1598
          </a>
        </div>
      </footer>

      {/* VideoAsk Panel */}
      <VideoAskPanel />
    </div>
  );
}