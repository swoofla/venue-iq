import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Phone } from 'lucide-react';

import ChatMessage from '@/components/chat/ChatMessage';
import TypingIndicator from '@/components/chat/TypingIndicator';
import QuickActions from '@/components/chat/QuickActions';
import ChatInput from '@/components/chat/ChatInput';
import BudgetCalculator from '@/components/flows/BudgetCalculator';
import AvailabilityChecker from '@/components/flows/AvailabilityChecker';
import TourScheduler from '@/components/flows/TourScheduler';
import PackagesView from '@/components/flows/PackagesView';
import VideoAskPanel from '@/components/VideoAskPanel';

const WELCOME_MESSAGE = "Welcome to Sugar Lake Weddings, we're glad to have you. How can we help you envision your perfect day here?";

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([
    { id: 1, text: WELCOME_MESSAGE, isBot: true }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [activeFlow, setActiveFlow] = useState(null);
  const [preSelectedDate, setPreSelectedDate] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    base44.auth.isAuthenticated().then(isAuth => {
      if (isAuth) {
        base44.auth.me().then(u => {
          setUser(u);
          // Redirect logged-in users to Dashboard
          window.location.href = '/Dashboard';
        });
      } else {
        setLoading(false);
      }
    });
  }, []);

  const { data: bookedDates = [] } = useQuery({
    queryKey: ['bookedDates'],
    queryFn: () => base44.entities.BookedDate.list(),
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
      addBotMessage("Thank you for reaching out! I can help you with budget planning, checking date availability, scheduling a tour, or exploring our packages. What would you like to know more about?");
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
    const submissionData = {
      ...data,
      source: 'budget_calculator',
      name: 'Budget Calculator User',
      email: 'pending@sugar-lake.com',
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
    const submissionData = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      wedding_date: data.weddingDate,
      guest_count: parseInt(data.guestCount) || null,
      tour_date: data.tourDate,
      tour_time: data.tourTime,
      source: 'tour_scheduler',
    };
    
    // Save to Base44 database
    await base44.entities.ContactSubmission.create(submissionData);
    
    // Sync to HighLevel (only works when backend functions are enabled)
    try {
      await base44.functions.createHighLevelContact({
        email: data.email,
        name: data.name,
        phone: data.phone,
        wedding_date: data.weddingDate,
        guest_count: data.guestCount,
        source: 'tour_scheduler'
      });
      
      await base44.functions.createHighLevelAppointment({
        email: data.email,
        name: data.name,
        phone: data.phone,
        tour_date: data.tourDate,
        tour_time: data.tourTime,
        wedding_date: data.weddingDate,
        guest_count: data.guestCount
      });
    } catch (error) {
      console.log('HighLevel sync will be available once backend functions are enabled');
    }
    
    setActiveFlow(null);
    setPreSelectedDate('');
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
          <h1 className="text-xl font-light tracking-wide">sugar lake weddings</h1>
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