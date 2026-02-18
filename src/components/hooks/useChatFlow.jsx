import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const getWelcomeMessage = (venueName) => `Welcome! I'm Sugar Lake's virtual planner, here to help you plan your dream wedding here. Together we can:

💰 Build a custom budget estimate
📦 Explore wedding packages
📅 Check if your date is available
🏠 Schedule an in-person tour`;

export default function useChatFlow({
  venueId,
  venueName,
  venue,
  user,
  bookedDates,
  venueKnowledge,
  firstLookConfig,
}) {
  const [messages, setMessages] = useState([
    { id: 1, text: getWelcomeMessage(venueName), isBot: true }
  ]);
  const [showGreeting, setShowGreeting] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [activeFlow, setActiveFlow] = useState(null);
  const [preSelectedDate, setPreSelectedDate] = useState('');
  const [awaitingPlannerContact, setAwaitingPlannerContact] = useState(false);
  const [originalQuestion, setOriginalQuestion] = useState('');
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [showTourPrompt, setShowTourPrompt] = useState(false);
  const [introResponded, setIntroResponded] = useState(false);
  const [welcomeVideoAdded, setWelcomeVideoAdded] = useState(false);
  const [additionalVideosAdded, setAdditionalVideosAdded] = useState(false);
  const [userWantsWelcomeVideo, setUserWantsWelcomeVideo] = useState(false);
  const [userWantsAdditionalVideos, setUserWantsAdditionalVideos] = useState(false);
  const initialPromptShownRef = useRef(false);
  const firstLookConfigRef = useRef(firstLookConfig);
  const messagesEndRef = useRef(null);

  // Keep firstLookConfig ref updated
  useEffect(() => {
    firstLookConfigRef.current = firstLookConfig;
  }, [firstLookConfig]);

  // Update welcome message when venue name changes
  useEffect(() => {
    if (!venueName) return; // Don't reset on empty
    setMessages([{ id: 1, text: getWelcomeMessage(venueName), isBot: true }]);
    initialPromptShownRef.current = false;
  }, [venueName]);

  // Show initial prompt after 1.5s delay
  useEffect(() => {
    // Don't start until venue is loaded AND we have exactly 1 message AND haven't shown yet
    if (!venueId || initialPromptShownRef.current || messages.length !== 1) return;
    
    let cancelled = false;
    initialPromptShownRef.current = true;
    
    const showPrompt = async () => {
      await new Promise(resolve => setTimeout(resolve, 1500));
      if (cancelled) return;
      
      setIsTyping(true);
      await new Promise(resolve => setTimeout(resolve, 1500));
      if (cancelled) return;
      
      setIsTyping(false);
      const config = firstLookConfigRef.current;
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: "Would you like to meet our head planner Saydee and get a quick look at the venue first?",
        isBot: true,
        showMeetPlannerButtons: config?.is_enabled
      }]);
    };
    
    showPrompt();
    
    return () => {
      cancelled = true;
    };
  }, [venueId, messages.length]);

  // Welcome video flow with smart delay
  useEffect(() => {
    if (firstLookConfig?.is_enabled && !welcomeVideoAdded && userWantsWelcomeVideo && venueId) {
      const addWelcomeVideo = async () => {
        setWelcomeVideoAdded(true);

        await new Promise(resolve => setTimeout(resolve, 800));

        if (firstLookConfig.welcome_video_id) {
          setMessages(prev => [...prev, {
            id: Date.now() + 1,
            isBot: true,
            isVideo: true,
            videoId: firstLookConfig.welcome_video_id,
            videoLabel: `Welcome to ${venueName}`,
            aspectRatio: 'portrait'
          }]);
        }

        // Smart delay: 5s default, but if user plays the video, wait for full duration
        await new Promise(resolve => {
          let resolved = false;
          
          const fallbackTimer = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              resolve();
            }
          }, 5000);

          const listenForPlay = () => {
            window._wq = window._wq || [];
            window._wq.push({
              id: firstLookConfig.welcome_video_id,
              onReady: (video) => {
                video.bind('play', () => {
                  clearTimeout(fallbackTimer);
                  const remainingMs = Math.ceil((video.duration() - video.time()) * 1000);
                  setTimeout(() => {
                    if (!resolved) {
                      resolved = true;
                      resolve();
                    }
                  }, remainingMs + 2000);
                });

                if (video.state() === 'playing') {
                  clearTimeout(fallbackTimer);
                  const remainingMs = Math.ceil((video.duration() - video.time()) * 1000);
                  setTimeout(() => {
                    if (!resolved) {
                      resolved = true;
                      resolve();
                    }
                  }, remainingMs + 2000);
                }
              }
            });
          };

          if (window.Wistia) {
            listenForPlay();
          } else {
            const interval = setInterval(() => {
              if (window.Wistia) {
                clearInterval(interval);
                listenForPlay();
              }
            }, 200);
          }
        });

        setIsTyping(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsTyping(false);
        setMessages(prev => [...prev, {
          id: Date.now() + 100,
          text: `Select one of the options below or ask me any questions about ${venueName} you have.`,
          isBot: true,
          showPostVideoOptions: true
        }]);
      };

      addWelcomeVideo();
    }
  }, [firstLookConfig, welcomeVideoAdded, userWantsWelcomeVideo, venueId, venueName]);

  // Additional videos flow
  useEffect(() => {
    if (firstLookConfig?.is_enabled && !additionalVideosAdded && userWantsAdditionalVideos && venueId) {
      const addAdditionalVideos = async () => {
        setAdditionalVideosAdded(true);

        if (firstLookConfig.video_options?.length > 0) {
          for (let i = 0; i < firstLookConfig.video_options.length; i++) {
            const option = firstLookConfig.video_options[i];
            if (option.video_id) {
              await new Promise(resolve => setTimeout(resolve, 400));

              setMessages(prev => [...prev, {
                id: Date.now() + i,
                isBot: true,
                isVideo: true,
                videoId: option.video_id,
                videoLabel: option.label,
                aspectRatio: 'portrait'
              }]);
            }
          }
        }

        await new Promise(resolve => setTimeout(resolve, 800));
        setIsTyping(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsTyping(false);
        setMessages(prev => [...prev, {
          id: Date.now() + 100,
          text: "What did you think? Ready to explore more or schedule a tour?",
          isBot: true
        }]);
      };

      addAdditionalVideos();
    }
  }, [firstLookConfig, additionalVideosAdded, userWantsAdditionalVideos, venueId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeFlow]);

  const addBotMessage = (text) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { id: Date.now(), text, isBot: true }]);
      setIsTyping(false);
    }, 1000);
  };

  const handleUserMessage = async (text) => {
    setShowGreeting(false);
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
          console.error("Failed to send lead to HighLevel:", error?.message || error);
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
    } else if (lowerText.includes('photo') || lowerText.includes('picture') || 
               lowerText.includes('gallery') || lowerText.includes('look like') ||
               lowerText.includes('see the venue') || lowerText.includes('show me')) {
      addBotMessage("Let me show you around! Here are some photos of our beautiful venue.");
      setTimeout(() => setActiveFlow('gallery'), 1500);
    } else if (lowerText.includes('visualize') || lowerText.includes('design') || 
               lowerText.includes('see my wedding') || lowerText.includes('what would it look like') ||
               lowerText.includes('decorate') || lowerText.includes('style')) {
      addBotMessage("Let me show you what your wedding could look like at our venue! ✨");
      setTimeout(() => setActiveFlow('visualizer'), 1500);
    } else if (lowerText.includes('video') || lowerText.includes('watch') || 
               lowerText.includes('first look') || lowerText.includes('virtual tour')) {
      if (firstLookConfig?.welcome_video_id) {
        addBotMessage("Here's a quick video tour of our venue! 🎥");
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: Date.now(),
            isBot: true,
            isVideo: true,
            videoId: firstLookConfig.welcome_video_id,
            videoLabel: `Welcome to ${venueName}`,
            aspectRatio: 'portrait'
          }]);
        }, 1000);
      } else {
        addBotMessage("Let me show you around with some photos!");
        setTimeout(() => setActiveFlow('gallery'), 1500);
      }
    } else if (lowerText.includes('talk to') || lowerText.includes('speak to') || 
               lowerText.includes('real person') || lowerText.includes('human') ||
               lowerText.includes('call') || lowerText.includes('phone')) {
      const contactMessage = venue?.phone || venue?.email 
        ? `I'd be happy to connect you with our team! You can reach us at ${venue.phone ? `${venue.phone}` : ''}${venue.phone && venue.email ? ' or ' : ''}${venue.email ? venue.email : ''}.`
        : "I'd be happy to connect you with our team! Please use the contact information on our website.";
      addBotMessage(contactMessage);
    } else {
      const relevantKnowledge = venueKnowledge.find(k => 
        lowerText.includes(k.question.toLowerCase()) || 
        k.question.toLowerCase().includes(lowerText)
      );

      if (relevantKnowledge) {
        addBotMessage(relevantKnowledge.answer);
      } else {
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
          console.error('AI response error:', error?.message || error);
          setMessages(prev => [...prev, { id: Date.now(), text: "Thank you for reaching out! I can help you with budget planning, checking date availability, scheduling a tour, or exploring our packages. What would you like to know more about?", isBot: true }]);
        }
        setIsTyping(false);
        return;
      }
    }
  };

  const handleQuickAction = (action) => {
    setShowGreeting(false);

    switch (action) {
      case 'budget':
        setMessages(prev => [...prev, { id: Date.now(), text: "I'd like to use the budget calculator", isBot: false }]);
        addBotMessage("Perfect! Let's find the ideal package for your budget. I'll guide you through a few questions to understand your vision.");
        setTimeout(() => setActiveFlow('budget'), 1500);
        break;
      case 'availability':
        setMessages(prev => [...prev, { id: Date.now(), text: "I want to check date availability", isBot: false }]);
        addBotMessage("Great choice! Let's see if your dream date is available. Please select a date from the calendar below.");
        setTimeout(() => setActiveFlow('availability'), 1500);
        break;
      case 'tour':
        setMessages(prev => [...prev, { id: Date.now(), text: "I'd like to schedule a tour", isBot: false }]);
        addBotMessage("Wonderful! We'd love to welcome you to Sugar Lake and show you around in person. Let's find a time that works best for you.");
        setTimeout(() => setActiveFlow('tour'), 1500);
        break;
      case 'packages':
        setMessages(prev => [...prev, { id: Date.now(), text: "Show me your packages", isBot: false }]);
        addBotMessage("Excellent! Here are our three beautiful packages, each thoughtfully designed to create an unforgettable celebration. Take a look:");
        setTimeout(() => setActiveFlow('packages'), 1500);
        break;
      case 'gallery':
        setMessages(prev => [...prev, { id: Date.now(), text: "I'd like to see photos of the venue", isBot: false }]);
        addBotMessage("I'd love to show you around! Here's a tour of our beautiful spaces. ✨");
        setTimeout(() => setActiveFlow('gallery'), 1000);
        break;
      case 'visualizer':
        setMessages(prev => [...prev, { id: Date.now(), text: "I want to visualize my wedding design", isBot: false }]);
        addBotMessage("How exciting! Let's create a custom vision of what your wedding could look like at our venue. ✨");
        setTimeout(() => setActiveFlow('visualizer'), 1000);
        break;
      case 'contact':
        setMessages(prev => [...prev, { id: Date.now(), text: "I'd like to talk to a real person", isBot: false }]);
        const contactMessage = venue?.phone || venue?.email 
          ? `I'd be happy to connect you with our team! You can reach us at ${venue.phone ? `${venue.phone}` : ''}${venue.phone && venue.email ? ' or ' : ''}${venue.email ? venue.email : ''}.`
          : "I'd be happy to connect you with our team! Please use the contact information on our website.";
        addBotMessage(contactMessage);
        break;
    }
  };

  const handleBudgetComplete = async (data) => {
    setActiveFlow(null);
    setLeadName(data.name);
    setLeadEmail(data.email);
    setLeadPhone(data.phone);

    const deliveryMessage = data.deliveryPreference === 'text' 
      ? `sent to your phone` 
      : `sent to your email`;

    setMessages(prev => [...prev, { 
      id: Date.now(), 
      text: `Budget estimate submitted - ${data.guestCount} guests, $${data.totalBudget.toLocaleString()}`, 
      isBot: false 
    }]);

    setTimeout(() => {
      addBotMessage(
        `Perfect! Your personalized budget estimate of $${data.totalBudget.toLocaleString()} has been ${deliveryMessage}. 💌\n\nWould you like to schedule a tour to see the venue in person? We'd love to walk you through the spaces and discuss your vision!`
      );
      setShowTourPrompt(true);
    }, 1000);
  };

  const handleAvailabilityTour = (date) => {
    setActiveFlow(null);
    setMessages(prev => [...prev, { 
      id: Date.now(), 
      text: `${date} is available!`, 
      isBot: false 
    }]);
    addBotMessage(`Great news! ${date} is available. Let's get your tour scheduled so you can see the venue in person.`);
    setTimeout(() => {
      setPreSelectedDate(date);
      setActiveFlow('tour');
    }, 1500);
  };

  const handleTourComplete = async (data) => {
    setActiveFlow(null);

    setMessages(prev => [...prev, { 
      id: Date.now(), 
      text: `Tour scheduled for ${data.tourDate} at ${data.tourTime}`, 
      isBot: false 
    }]);

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

    await base44.entities.ContactSubmission.create(submissionData);

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
      console.error('HighLevel sync error:', error?.response?.data || error?.message || error);
    }

    addBotMessage(`Wonderful! Your tour is scheduled for ${data.tourDate} at ${data.tourTime}. We'll send you a confirmation shortly. Looking forward to meeting you! 🎉`);
  };

  const handlePackageTour = (packageName) => {
    setActiveFlow(null);
    setMessages(prev => [...prev, { 
      id: Date.now(), 
      text: `Interested in the ${packageName} package`, 
      isBot: false 
    }]);
    addBotMessage(`Excellent choice! The ${packageName} package is one of our favorites. Let's schedule a tour so you can see everything in person.`);
    setTimeout(() => setActiveFlow('tour'), 1500);
  };

  const closeFlow = () => {
    setActiveFlow(null);
    setPreSelectedDate('');
    addBotMessage("No problem! Is there anything else I can help you with?");
  };

  const handleIntroYes = () => {
    setIntroResponded(true);
    setShowGreeting(false);
  };

  const handleIntroSkip = () => {
    setIntroResponded(true);
    setShowGreeting(false);
    setMessages(prev => [...prev, { id: Date.now(), text: "I know what I need", isBot: false }]);
    addBotMessage("Perfect! Use the buttons below or just type what you're looking for.");
  };

  const handleMeetPlanner = () => {
    const plannerName = firstLookConfig?.host_name || 'the planner';
    setMessages(prev => [...prev, { id: Date.now(), text: `Meet ${plannerName}`, isBot: false }]);
    setUserWantsWelcomeVideo(true);
  };

  const handleSkipVideos = () => {
    setIntroResponded(true);
    setMessages(prev => [...prev, { id: Date.now(), text: "Explore venue tools", isBot: false }]);
    addBotMessage("Perfect! Use the buttons below or just type what you're looking for.");
  };

  const handleBudgetFromVideo = () => {
    setMessages(prev => [...prev, { id: Date.now(), text: "Calculate my budget", isBot: false }]);
    addBotMessage("Let's build your custom budget estimate!");
    setTimeout(() => setActiveFlow('budget'), 1500);
  };

  const handleMiniTourFromVideo = () => {
    setMessages(prev => [...prev, { id: Date.now(), text: "Watch mini tour", isBot: false }]);
    setUserWantsAdditionalVideos(true);
  };

  return {
    messages,
    showGreeting,
    isTyping,
    activeFlow,
    preSelectedDate,
    showTourPrompt,
    introResponded,
    leadName,
    leadEmail,
    leadPhone,
    messagesEndRef,
    handleUserMessage,
    handleQuickAction,
    handleBudgetComplete,
    handleAvailabilityTour,
    handleTourComplete,
    handlePackageTour,
    closeFlow,
    handleIntroYes,
    handleIntroSkip,
    handleMeetPlanner,
    handleSkipVideos,
    handleBudgetFromVideo,
    handleMiniTourFromVideo,
    setShowTourPrompt,
    setActiveFlow,
  };
}