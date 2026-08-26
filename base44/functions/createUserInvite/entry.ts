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
        subject: `Set up your Virtual Planner account for ${venue.name}`,
        from_name: 'Virtual Planner',
        body: `<div style="max-width:520px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="background-color:#000000;padding:20px 28px;border-radius:12px 12px 0 0;">
<div style="color:#ffffff;font-size:17px;font-weight:500;line-height:1.2;">Virtual Planner</div>
<div style="color:#a8a29e;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;margin-top:5px;">Venue access</div>
</div>
<div style="background-color:#ffffff;padding:28px;border:1px solid #e7e5e4;border-top:none;border-radius:0 0 12px 12px;">
<p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#1c1917;">${greeting}</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#1c1917;">You've been given access to your venue's planner.</p>
<div style="background-color:#fafaf9;border:1px solid #e7e5e4;border-radius:8px;padding:16px 18px;margin:0 0 22px;">
<div style="font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#78716c;">Venue</div>
<div style="font-size:19px;font-weight:500;color:#1c1917;margin-top:4px;">${venue.name}</div>
<div style="font-size:13px;color:#57534e;margin-top:6px;">Your role: ${roleLabel}</div>
</div>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#57534e;">Your planner answers couples' questions on your website, checks your open dates, and passes real enquiries to your team. Set up your account and you'll see what it still needs to learn about your venue.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr><td bgcolor="#000000" style="border-radius:999px;">
<a href="${inviteUrl}" style="display:inline-block;background-color:#000000;color:#ffffff;font-size:15px;font-weight:500;text-decoration:none;padding:13px 30px;border-radius:999px;">Accept your invitation</a>
</td></tr></table>
<p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#78716c;">Or paste this into your browser:<br><span style="color:#57534e;word-break:break-all;">${inviteUrl}</span></p>
<div style="border-top:1px solid #e7e5e4;padding-top:16px;">
<p style="margin:0;font-size:12px;line-height:1.6;color:#a8a29e;">This link expires in 7 days. If you weren't expecting it, you can ignore this email.</p>
</div>
</div>
</div>`
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