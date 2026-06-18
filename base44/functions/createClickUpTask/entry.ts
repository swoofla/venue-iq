Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      comment = '',
      flagged_message = '',
      preceding_user_message = '',
      chat_session_id = '',
      venue_id = '',
      feedback_id = '',
    } = body;

    const token = Deno.env.get('CLICKUP_API_TOKEN');
    const listId = Deno.env.get('CLICKUP_FEEDBACK_LIST_ID');
    if (!token || !listId) {
      return Response.json({ success: false, error: 'ClickUp not configured (missing CLICKUP_API_TOKEN or CLICKUP_FEEDBACK_LIST_ID)' }, { status: 200 });
    }

    const name = 'Chatbot 👎' + (comment ? ' — ' + comment.slice(0, 60) : '');
    const markdown_content = [
      '**Comment:** ' + (comment || '—'),
      '**She said:** ' + (preceding_user_message || '—'),
      '**Bot replied:** ' + (flagged_message || '—'),
      '**Session:** ' + (chat_session_id || '—'),
      '**Feedback ID:** ' + (feedback_id || '—'),
      '**Venue:** ' + (venue_id || '—'),
      '',
      'Full transcript + debug trace are in the VenueIQ Feedback page.',
    ].join('\n');

    const resp = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
      method: 'POST',
      headers: { 'Authorization': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, markdown_content }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error('ClickUp create task failed:', resp.status, text);
      return Response.json({ success: false, error: `ClickUp ${resp.status}: ${text}` }, { status: 200 });
    }

    const data = await resp.json();
    return Response.json({ success: true, taskId: data?.id });
  } catch (error) {
    console.error('createClickUpTask error:', error?.message || error);
    return Response.json({ success: false, error: error?.message || String(error) }, { status: 200 });
  }
});