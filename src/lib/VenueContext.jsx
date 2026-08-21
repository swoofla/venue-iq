import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// Holds the venue a super admin is currently managing, above page level so it
// survives navigation. Previously each page kept this in local useState, so
// the choice reset every time the user clicked a nav link.
//
// Resolution order: URL ?venue_id= → localStorage → the user's own venue_id.
// A venue owner always resolves to their own venue and never sees a selector.

const STORAGE_KEY = 'viq_selected_venue';
const VenueContext = createContext(null);

export function VenueProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const [selectedVenueId, setSelectedVenueIdState] = useState(null);

  useEffect(() => {
    base44.auth.me()
      .then(u => setUser(u))
      .catch(err => {
        // Anonymous visitors hit this on the public chatbot. Not an error.
        console.warn('[VenueContext] No authenticated user:', err?.message || err);
        setUser(null);
      })
      .finally(() => setUserLoading(false));
  }, []);

  // Seed from the URL first, then localStorage. Read window.location directly
  // rather than useSearchParams so this provider can sit outside the Router.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('venue_id');
    if (fromUrl) {
      setSelectedVenueIdState(fromUrl);
      try { localStorage.setItem(STORAGE_KEY, fromUrl); } catch (e) { /* private mode */ }
      return;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSelectedVenueIdState(stored);
    } catch (e) { /* private mode */ }
  }, []);

  const setVenueId = (id) => {
    setSelectedVenueIdState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* private mode */ }
  };

  const isAdmin = user?.role === 'admin';

  // A venue user's own venue always wins. Only an admin with no venue_id of
  // their own falls through to the selected one.
  const venueId = user?.venue_id || (isAdmin ? selectedVenueId : null);

  const { data: venues = [] } = useQuery({
    queryKey: ['venues'],
    queryFn: () => base44.entities.Venue.list(),
    enabled: !!isAdmin
  });

  const selectedVenue = venues.find(v => v.id === venueId) || null;

  return (
    <VenueContext.Provider value={{
      user,
      userLoading,
      isAdmin,
      venueId,
      setVenueId,
      venues,
      selectedVenue,
      needsVenueSelection: !userLoading && isAdmin && !user?.venue_id && !venueId
    }}>
      {children}
    </VenueContext.Provider>
  );
}

export function useVenue() {
  const ctx = useContext(VenueContext);
  if (!ctx) throw new Error('useVenue must be used within a VenueProvider');
  return ctx;
}

export default VenueContext;