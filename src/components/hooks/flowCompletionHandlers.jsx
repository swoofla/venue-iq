import { base44 } from '@/api/base44Client';

// Pure factory: extracts the four flow-completion handlers out of useChatFlow so
// the hook stays under the edit-limit line count. Handlers keep exactly the same
// behavior — no logic changes here. All state comes in via a single deps bag.
export function createFlowCompletionHandlers(deps) {
  const {
    venueId,
    venueName,
    setActiveFlow,
    setLeadName,
    setLeadEmail,
    setLeadPhone,
    setPreSelectedDate,
    setMessages,
    setShowTourPrompt,
    addBotMessage,
    leadGuestCountRef,
    leadBudgetRangeRef,
    leadWeddingDateRef,
    flowsCompletedRef,
    flowResultsRef,
  } = deps;

  const handleBudgetComplete = async (data) => {
    setActiveFlow(null);
    setLeadName(data.name);
    setLeadEmail(data.email);
    setLeadPhone(data.phone);

    if (data.guestCount) {
      leadGuestCountRef.current = parseInt(data.guestCount) || null;
    }
    flowsCompletedRef.current = Array.from(new Set([...(flowsCompletedRef.current || []), 'budget_calculator']));
    flowResultsRef.current = {
      ...flowResultsRef.current,
      budget_calculator: { total: data.totalBudget }
    };
    if (data.totalBudget) {
      const k = Math.round(data.totalBudget / 1000);
      leadBudgetRangeRef.current = `$${k}k`;
    }

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
    leadWeddingDateRef.current = date;
    flowsCompletedRef.current = Array.from(new Set([...(flowsCompletedRef.current || []), 'date_check']));
    flowResultsRef.current = {
      ...flowResultsRef.current,
      date_check: { date, available: true }
    };
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

    if (data.weddingDate) leadWeddingDateRef.current = data.weddingDate;
    if (data.guestCount) leadGuestCountRef.current = parseInt(data.guestCount) || null;
    flowsCompletedRef.current = Array.from(new Set([...(flowsCompletedRef.current || []), 'tour_scheduler']));
    flowResultsRef.current = {
      ...flowResultsRef.current,
      tour_scheduler: { tour_date: data.tourDate, tour_time: data.tourTime }
    };

    const submissionData = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      wedding_date: data.weddingDate,
      guest_count: parseInt(data.guestCount) || null,
      tour_date: data.tourDate,
      tour_time: data.tourTime,
      source: 'tour_scheduler',
      venue_id: venueId,
    };

    await base44.entities.ContactSubmission.create(submissionData);

    // Attempt the HighLevel sync. If the appointment fails, we must NOT tell the
    // bride her tour is scheduled — HL is the source of truth for the planner's
    // calendar. Fall back to a "planner will confirm shortly" message instead.
    let appointmentBooked = false;
    let appointmentError = null;
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
        guest_count: data.guestCount,
        timezone: data.timezone,
      });
      console.log('Appointment created:', appointmentRes.data);

      // The function returns { success: true, appointmentId } on the happy path
      // and { error: '...' } (with HTTP 500) on failure. base44.functions.invoke
      // still resolves on non-2xx, so we must check the payload explicitly.
      if (appointmentRes?.data?.success && appointmentRes?.data?.appointmentId) {
        appointmentBooked = true;
      } else {
        appointmentError = appointmentRes?.data?.error || 'unknown_error';
      }
    } catch (error) {
      appointmentError = error?.response?.data?.error || error?.message || String(error);
      console.error('HighLevel sync error:', appointmentError);
    }

    // Record the outcome on the ContactSubmission notes so venue staff can see
    // failures without digging into logs.
    if (!appointmentBooked) {
      try {
        await base44.entities.ContactSubmission.updateMany(
          { venue_id: venueId, email: data.email, tour_date: data.tourDate, tour_time: data.tourTime },
          { $set: { notes: `Tour request captured but HighLevel appointment sync failed: ${String(appointmentError).slice(0, 400)}` } }
        );
      } catch (_) { /* non-blocking */ }
    }

    if (appointmentBooked) {
      addBotMessage(`Wonderful! Your tour is scheduled for ${data.tourDate} at ${data.tourTime}. We'll send you a confirmation shortly. Looking forward to meeting you! 🎉`);
    } else {
      addBotMessage(`Thanks so much, ${data.name.split(' ')[0]}! I've passed your tour request along to our team — someone will reach out shortly to confirm your ${data.tourDate} at ${data.tourTime} visit. If you don't hear back within a business day, just reply here and I'll follow up.`);
    }
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

  return {
    handleBudgetComplete,
    handleAvailabilityTour,
    handleTourComplete,
    handlePackageTour,
  };
}