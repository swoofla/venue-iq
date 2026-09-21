import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

export default function HighLevelConnection({ venueId }) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const check = async () => {
    setChecking(true);
    setResult(null);
    try { setResult((await base44.functions.invoke('checkHighLevelConnection', { venueId })).data); }
    catch { setResult({ connected: false, message: 'Unable to check the connection. Please try again.' }); }
    finally { setChecking(false); }
  };
  return <section className="rounded-xl border border-stone-200 p-6 mt-6">
    <h3 className="font-semibold mb-2">HighLevel — handoffs &amp; tours</h3>
    <p className="text-sm text-stone-600 mb-4">Connect this venue’s HighLevel account for planner texts and tour bookings. Google Calendar above manages wedding availability separately.</p>
    <Button onClick={check} disabled={checking}>{checking ? 'Checking…' : 'Check HighLevel connection'}</Button>
    {result && <p role="status" className={`mt-3 text-sm ${result.connected ? 'text-green-800' : 'text-amber-800'}`}>{result.message}</p>}
  </section>;
}
