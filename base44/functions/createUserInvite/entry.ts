import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { email, name, venue_id, role, created_by } = await req.json();

    if (!email || !venue_id || !role) {
      return Response.json({ 
        success: false, 
        error: 'Email, venue_id, and role are required' 
      }, { status: 400 });
    }

    if (!['venue_owner', 'venue_staff'].includes(role)) {
      return Response.json({ 
        success: false, 
        error: 'Invalid role. Must be venue_owner or venue_staff' 
      }, { status: 400 });
    }

    const venue = await base44.asServiceRole.entities.Venue.get(venue_id);
    if (!venue) {
      return Response.json({ success: false, error: 'Venue not found' }, { status: 404 });
    }

    const existingInvites = await base44.asServiceRole.entities.UserInvite.filter({ 
      email, 
      venue_id,
      status: 'pending' 
    });
    
    for (const existing of existingInvites) {
      await base44.asServiceRole.entities.UserInvite.update(existing.id, {
        status: 'expired'
      });
    }

    const existingUsers = await base44.asServiceRole.entities.User.filter({ 
      email,
      venue_id 
    });
    
    if (existingUsers.length > 0) {
      return Response.json({ 
        success: false, 
        error: 'User already has access to this venue' 
      }, { status: 400 });
    }

    const token = crypto.randomUUID();
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await base44.asServiceRole.entities.UserInvite.create({
      email,
      name: name || null,
      venue_id,
      role,
      token,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
      created_by: created_by || null
    });

    const baseUrl = req.headers.get('origin') || 'https://your-app.base44.app';
    const inviteUrl = `${baseUrl}/invite?token=${token}`;

    return Response.json({ 
      success: true,
      invite_id: invite.id,
      invite_url: inviteUrl,
      token,
      expires_at: expiresAt.toISOString()
    });

  } catch (error) {
    console.error('createUserInvite error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});