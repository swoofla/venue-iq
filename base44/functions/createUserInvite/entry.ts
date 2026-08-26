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

    // Never derive the invite host from the request origin: inside the Base44
    // editor that is a preview sandbox the recipient cannot authenticate
    // against. Always issue links on the production host.
    const baseUrl = 'https://myvirtualplanner.app';
    const inviteUrl = `${baseUrl}/invite?token=${token}`;

    const roleLabel = role === 'venue_owner' ? 'Venue Owner' : 'Staff Member';
    const greeting = name ? `Hi ${name},` : 'Hi,';

    let emailSent = false;
    let emailError = null;
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject: `You're invited to ${venue.name} on Virtual Planner`,
        from_name: 'Virtual Planner',
        body: `${greeting}

You've been invited to join ${venue.name} on Virtual Planner as a ${roleLabel}.

Accept your invitation here:
${inviteUrl}

This link expires in 7 days.

If you weren't expecting this, you can ignore this email.`
      });
      emailSent = true;
    } catch (err) {
      // A delivery failure must never fail invite creation - the record exists
      // and the admin can still copy the link manually.
      emailError = err?.message || String(err);
      console.error('createUserInvite: email send failed', emailError);
    }

    return Response.json({ 
      success: true,
      invite_id: invite.id,
      invite_url: inviteUrl,
      token,
      expires_at: expiresAt.toISOString(),
      email_sent: emailSent,
      email_error: emailError
    });

  } catch (error) {
    console.error('createUserInvite error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});