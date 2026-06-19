import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token } = await req.json();
    if (!token) {
      return Response.json({ success: false, error: 'No invitation token provided' }, { status: 400 });
    }
    const invites = await base44.asServiceRole.entities.UserInvite.filter({ token });
    if (invites.length === 0) {
      return Response.json({ success: false, error: 'Invalid invitation link' }, { status: 404 });
    }
    const invite = invites[0];
    if (invite.status === 'accepted') {
      return Response.json({ success: false, error: 'This invitation has already been used. Please log in instead.' }, { status: 400 });
    }
    if (invite.status === 'expired' || (invite.expires_at && new Date(invite.expires_at) < new Date())) {
      return Response.json({ success: false, error: 'This invitation has expired. Please contact the administrator for a new invite.' }, { status: 400 });
    }
    let venue_name = null;
    try { const v = await base44.asServiceRole.entities.Venue.get(invite.venue_id); venue_name = v?.name || null; } catch (_e) {}
    return Response.json({
      success: true,
      invite: { email: invite.email, name: invite.name || null, role: invite.role, venue_id: invite.venue_id, venue_name, status: invite.status }
    });
  } catch (error) {
    console.error('validateUserInvite error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});