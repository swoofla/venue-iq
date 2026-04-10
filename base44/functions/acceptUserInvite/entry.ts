import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token, name } = await req.json();

    if (!token) {
      return Response.json({ success: false, error: 'Token is required' }, { status: 400 });
    }

    const invites = await base44.asServiceRole.entities.UserInvite.filter({ token });
    
    if (invites.length === 0) {
      return Response.json({ success: false, error: 'Invalid invitation' }, { status: 404 });
    }

    const invite = invites[0];

    if (invite.status !== 'pending') {
      return Response.json({ success: false, error: 'Invitation already used' }, { status: 400 });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return Response.json({ success: false, error: 'Invitation expired' }, { status: 400 });
    }

    const existingUsers = await base44.asServiceRole.entities.User.filter({ email: invite.email });
    
    if (existingUsers.length > 0) {
      await base44.asServiceRole.entities.User.update(existingUsers[0].id, {
        venue_id: invite.venue_id,
        role: invite.role,
        full_name: name || existingUsers[0].full_name
      });
    } else {
      await base44.asServiceRole.entities.User.create({
        email: invite.email,
        full_name: name || invite.name || 'User',
        role: invite.role,
        venue_id: invite.venue_id
      });
    }

    await base44.asServiceRole.entities.UserInvite.update(invite.id, {
      status: 'accepted',
      accepted_at: new Date().toISOString()
    });

    return Response.json({ 
      success: true,
      venue_id: invite.venue_id,
      role: invite.role
    });

  } catch (error) {
    console.error('acceptUserInvite error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});