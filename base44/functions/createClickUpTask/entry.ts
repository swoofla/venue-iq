import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Creates a ClickUp task from a ChatFeedback record so thumbs-down feedback
// shows up in the team's ClickUp list. Mirrors the structure of
// checkDateAvailability — service-role entity reads, plain Response.json output.

Deno.serve(async (req) => {
  try {
    const { feedbackId } = await req.json();
    if (!feedbackId) {
      return Response.json({ error: 'feedbackId is required' }, { status: 400 });
    }

    const token = Deno.env.get('CLICKUP_API_TOKEN');
    const listId = Deno.env.get('CLICKUP_FEEDBACK_LIST_ID');
    if (!token || !listId) {
      return Response.json({ success: false, error: 'ClickUp not configured' });
    }

    const base44 = createClientFromRequest(req);
    const feedback = await base44.asServiceRole.entities.ChatFeedback.get(feedbackId);
    if (!feedback) {
      return Response.json({ success: false, error: 'Feedback record not found' });
    }

    const comment = feedback.comment || '';
    const trimmed = comment ? ` — ${comment.slice(0, 60)}` : '';
    const name = `Chatbot 👎${trimmed}`;

    const markdown_content = [
      `**Comment:** ${comment || '—'}`,
      `**She said:** ${feedback.preceding_user_message || '—'}`,
      `**Bot replied:** ${feedback.flagged_message || '—'}`,
      `**Session:** ${feedback.chat_session_id || '—'}`,
      `**Logged:** ${feedback.created_date || ''}`,
      '',
      'Full transcript + debug trace are in the VenueIQ Feedback page.',
    ].join('\n');

    const res = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
      method: 'POST',
      headers: {
        // ClickUp personal tokens go in Authorization as-is — NOT "Bearer ..."
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, markdown_content }),
    });

    if (!res.ok) {
      const error = await res.text();
      return Response.json({ success: false, error });
    }

    const data = await res.json();
    return Response.json({ success: true, taskId: data.id });
  } catch (error) {
    console.error('createClickUpTask error:', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});