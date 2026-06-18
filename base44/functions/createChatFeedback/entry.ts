import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Persists a ChatFeedback record via service role.
// Frontend anonymous ChatFeedback.create returns a record but does not persist
// (RLS interaction issue with anonymous create + user-scoped read policy), so the
// browser hands off to this function which writes with service role and then
// reads the record back to confirm it actually landed.

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const base44 = createClientFromRequest(req);

    const created = await base44.asServiceRole.entities.ChatFeedback.create({
      venue_id: payload.venue_id,
      chat_session_id: payload.chat_session_id,
      rating: payload.rating,
      comment: payload.comment,
      flagged_message: payload.flagged_message,
      preceding_user_message: payload.preceding_user_message,
      transcript: payload.transcript,
      debug_trace: payload.debug_trace,
    });

    // Verify it actually persisted before reporting success.
    const verify = await base44.asServiceRole.entities.ChatFeedback.get(created.id);
    if (!verify) {
      return Response.json({ error: 'Record did not persist' }, { status: 500 });
    }

    return Response.json({ success: true, id: created.id });
  } catch (error) {
    console.error('createChatFeedback error:', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});