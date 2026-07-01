import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const HIGHLEVEL_API_KEY = Deno.env.get('HIGHLEVEL_API_KEY');
  const HIGHLEVEL_LOCATION_ID = Deno.env.get('HIGHLEVEL_LOCATION_ID');

  if (!HIGHLEVEL_API_KEY || !HIGHLEVEL_LOCATION_ID) {
    return Response.json({ success: false, error: 'HighLevel credentials not configured' }, { status: 500 });
  }

  const base44 = createClientFromRequest(req);

  try {
    let { venueId, chatSessionId, leadName, leadPhone, leadEmail, topicSummary, originalQuestion } = await req.json();

    // Entry sanitizer: strip any invisible/control chars from phone before validation or downstream use.
    leadPhone = String(leadPhone ?? '').replace(/[^\d+]/g, '');

    if (!venueId || !chatSessionId || !leadName || !leadPhone || !topicSummary || !originalQuestion) {
      return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // STEP A: Fetch venue
    const venue = await base44.asServiceRole.entities.Venue.get(venueId);
    const headPlannerName = venue?.head_planner_name || 'our head planner';
    const venueName = venue?.name || 'the venue';
    const venueDomain = venue?.domain || 'sugarlakeweddings.com';

    // STEP B: Fetch chat session
    const chatSession = await base44.asServiceRole.entities.ChatSession.get(chatSessionId);

    // Normalize phone
    const digits = String(leadPhone).replace(/\D/g, '');
    const cleanPhone = digits.length === 10 ? `+1${digits}` : `+${digits}`;

    // STEP C: Upsert contact in HighLevel
    let leadContactId = null;
    try {
      const upsertRes = await fetch('https://services.leadconnectorhq.com/contacts/upsert', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HIGHLEVEL_API_KEY}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          locationId: HIGHLEVEL_LOCATION_ID,
          firstName: leadName.split(' ')[0],
          lastName: leadName.split(' ').slice(1).join(' ') || '',
          phone: cleanPhone,
          email: leadEmail || undefined,
          source: `${venueName} Virtual Planner`,
          tags: [
            'Virtual Planner Lead',
            'Planner_Contact_Requested',
            `topic_${topicSummary.toLowerCase().replace(/\s+/g, '_')}`
          ],
          customFields: [
            { key: 'wedding_date', field_value: chatSession?.lead_wedding_date || '' },
            { key: 'guest_count', field_value: chatSession?.lead_guest_count?.toString() || '' },
            { key: 'chatbot_question', field_value: originalQuestion }
          ]
        })
      });

      const upsertText = await upsertRes.text();
      console.log('Upsert status:', upsertRes.status, 'body:', upsertText);

      if (!upsertRes.ok) {
        throw new Error(`Contact upsert failed: ${upsertText}`);
      }

      const upsertData = JSON.parse(upsertText);
      leadContactId = upsertData.contact?.id || upsertData.id;
      if (!leadContactId) throw new Error('No contact id in upsert response');
    } catch (upsertError) {
      console.error('Contact upsert error:', upsertError.message);
      await base44.asServiceRole.entities.HandoffRequest.create({
        venue_id: venueId,
        chat_session_id: chatSessionId,
        lead_name: leadName,
        lead_phone: leadPhone,
        lead_email: leadEmail || undefined,
        topic_summary: topicSummary,
        original_question: originalQuestion,
        status: 'intro_failed',
        error_message: upsertError.message
      });
      return Response.json({ success: false, error: upsertError.message }, { status: 500 });
    }

    // STEP D: Transcript URL
    const transcriptUrl = `https://${venueDomain}/ChatTranscript?id=${chatSessionId}`;

    // STEP E: Add note to contact
    let noteId = null;
    try {
      const noteBody =
        `⚡ HANDOFF FROM VIRTUAL PLANNER\n\n` +
        `📄 Full conversation: ${transcriptUrl}\n\n` +
        `Topic: ${topicSummary}\n` +
        `Wedding date: ${chatSession?.lead_wedding_date || 'not shared'}\n` +
        `Guest count: ${chatSession?.lead_guest_count || 'not shared'}\n` +
        `Budget feel: ${chatSession?.lead_budget_range || 'not shared'}\n` +
        `Flows completed: ${(chatSession?.flows_completed || []).join(', ') || 'none'}\n\n` +
        `Her exact question:\n"${originalQuestion}"\n\n` +
        `Auto-sent intro at ${new Date().toLocaleString()}. Reply in this thread to continue the conversation with the lead.`;

      const noteRes = await fetch(`https://services.leadconnectorhq.com/contacts/${leadContactId}/notes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HIGHLEVEL_API_KEY}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ body: noteBody })
      });

      const noteText = await noteRes.text();
      console.log('Note status:', noteRes.status);
      if (noteRes.ok) {
        const noteData = JSON.parse(noteText);
        noteId = noteData.note?.id || noteData.id;
      } else {
        console.error('Note creation failed:', noteText);
      }
    } catch (noteError) {
      console.error('Note error (non-blocking):', noteError.message);
    }

    // STEP F: Send intro iMessage to the LEAD
    let messageId = null;
    let introStatus = 'intro_sent';
    let smsErrorMessage = null;
    try {
      const firstName = leadName.split(' ')[0];
      const plannerFirst = headPlannerName.split(' ')[0];
      const smsBody =
        `Hi ${firstName}! 👋 The virtual planner at ${venueName} here. I just passed your ${topicSummary} question over to ${plannerFirst}, our head planner. She'll text you back from this number shortly. Feel free to reply with anything else in the meantime!\n\nReply STOP to opt out.`;

      const smsRes = await fetch('https://services.leadconnectorhq.com/conversations/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HIGHLEVEL_API_KEY}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          type: 'SMS',
          contactId: leadContactId,
          message: smsBody
        })
      });

      const smsText = await smsRes.text();
      console.log('SMS status:', smsRes.status, 'body:', smsText);
      if (smsRes.ok) {
        const smsData = JSON.parse(smsText);
        messageId = smsData.messageId || smsData.id || null;
      } else {
        introStatus = 'intro_failed';
        try {
          smsErrorMessage = `SMS send ${smsRes.status}: ${smsText}`.slice(0, 500);
        } catch (_) { /* ignore */ }
        console.error('Intro SMS failed:', smsText);
      }
    } catch (smsError) {
      introStatus = 'intro_failed';
      try {
        smsErrorMessage = `SMS send exception: ${smsError.message}`.slice(0, 500);
      } catch (_) { /* ignore */ }
      console.error('Intro SMS error:', smsError.message);
    }

    // STEP G: Update ChatSession
    try {
      await base44.asServiceRole.entities.ChatSession.update(chatSessionId, {
        handoff_triggered: true,
        handoff_topic: topicSummary,
        status: 'handed_off'
      });
    } catch (updateError) {
      console.error('ChatSession update failed:', updateError.message);
    }

    // STEP H: Create HandoffRequest
    const handoff = await base44.asServiceRole.entities.HandoffRequest.create({
      venue_id: venueId,
      chat_session_id: chatSessionId,
      lead_name: leadName,
      lead_phone: leadPhone,
      lead_email: leadEmail || undefined,
      topic_summary: topicSummary,
      original_question: originalQuestion,
      ghl_lead_contact_id: leadContactId,
      ghl_intro_message_id: messageId || undefined,
      ghl_note_id: noteId || undefined,
      transcript_url: transcriptUrl,
      status: introStatus,
      error_message: smsErrorMessage || undefined
    });

    return Response.json({
      success: introStatus === 'intro_sent',
      handoffId: handoff.id,
      leadContactId,
      messageId,
      transcriptUrl
    });
  } catch (error) {
    console.error('createHighLevelLeadAndNotify error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});