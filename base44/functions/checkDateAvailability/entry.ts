import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Public availability check for the chatbot.
// Returns whether a single date is booked/blocked, plus the nearest available
// alternatives — without exposing any couple PII from BookedWeddingDate.
//
// Anonymous (no auth) is allowed because the chatbot runs unauthenticated.

const DAY_MS = 24 * 60 * 60 * 1000;

function toIsoLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function partsFromIso(iso) {
  const [y, m, d] = iso.split('-').map(n => parseInt(n, 10));
  return new Date(y, m - 1, d);
}

Deno.serve(async (req) => {
  try {
    const { venueId, date, alternativesCount = 3 } = await req.json();
    if (!venueId || !date) {
      return Response.json({ error: 'venueId and date are required' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    const [booked, blocked] = await Promise.all([
      base44.asServiceRole.entities.BookedWeddingDate.filter({ venue_id: venueId }),
      base44.asServiceRole.entities.BlockedDate.filter({ venue_id: venueId }),
    ]);

    const unavailable = new Set([
      ...booked.map(b => b.date).filter(Boolean),
      ...blocked.map(b => b.date).filter(Boolean),
    ]);

    const isAvailable = !unavailable.has(date);

    // Build alternatives only if requested date is unavailable
    let alternatives = [];
    if (!isAvailable) {
      const target = partsFromIso(date);
      const now = new Date();
      const todayFloor = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const candidateAt = (offsetDays) => {
        const d = new Date(target.getTime() + offsetDays * DAY_MS);
        if (d < todayFloor) return null;
        const iso = toIsoLocal(d);
        if (unavailable.has(iso)) return null;
        return iso;
      };

      const seen = new Set();
      const push = (iso) => {
        if (iso && !seen.has(iso)) {
          seen.add(iso);
          alternatives.push(iso);
        }
      };

      // Same day-of-week within ±6 weeks first
      for (let w = 1; w <= 6 && alternatives.length < alternativesCount; w++) {
        for (const dir of [1, -1]) {
          if (alternatives.length >= alternativesCount) break;
          push(candidateAt(w * 7 * dir));
        }
      }
      // Fallback: nearest calendar days within ±120 days
      for (let o = 1; o <= 120 && alternatives.length < alternativesCount; o++) {
        for (const dir of [1, -1]) {
          if (alternatives.length >= alternativesCount) break;
          push(candidateAt(o * dir));
        }
      }
    }

    return Response.json({
      venueId,
      date,
      isAvailable,
      alternatives,
    });
  } catch (error) {
    console.error('checkDateAvailability error:', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});