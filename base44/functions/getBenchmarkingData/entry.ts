import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role to get data across all venues
    const [allWeddings, allPackages, allSubmissions] = await Promise.all([
      base44.asServiceRole.entities.BookedWeddingDate.list(),
      base44.asServiceRole.entities.VenuePackage.list(),
      base44.asServiceRole.entities.ContactSubmission.list()
    ]);

    // Calculate average package pricing
    const avgPackagePricing = allPackages.length > 0
      ? allPackages.reduce((sum, pkg) => sum + (pkg.price || 0), 0) / allPackages.length
      : 0;

    // Calculate most popular booking months
    const monthCounts = {};
    allWeddings.forEach(wedding => {
      const month = new Date(wedding.date).getMonth();
      monthCounts[month] = (monthCounts[month] || 0) + 1;
    });
    const popularMonths = Object.entries(monthCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([month]) => parseInt(month));

    // Calculate most popular packages
    const packageCounts = {};
    allWeddings.forEach(wedding => {
      if (wedding.package) {
        packageCounts[wedding.package] = (packageCounts[wedding.package] || 0) + 1;
      }
    });

    // Calculate average budget ranges
    const budgets = allSubmissions.filter(s => s.budget).map(s => s.budget);
    const avgBudget = budgets.length > 0
      ? budgets.reduce((sum, b) => sum + b, 0) / budgets.length
      : 0;

    // Calculate average guest count
    const guestCounts = allWeddings.filter(w => w.guest_count).map(w => w.guest_count);
    const avgGuestCount = guestCounts.length > 0
      ? guestCounts.reduce((sum, g) => sum + g, 0) / guestCounts.length
      : 0;

    // Calculate feature usage
    const featureUsage = {};
    allSubmissions.forEach(submission => {
      if (submission.source) {
        featureUsage[submission.source] = (featureUsage[submission.source] || 0) + 1;
      }
    });

    // Calculate average booking lead time (days between submission and wedding date)
    const leadTimes = allSubmissions
      .filter(s => s.wedding_date && s.created_date)
      .map(s => {
        const weddingDate = new Date(s.wedding_date);
        const createdDate = new Date(s.created_date);
        return Math.floor((weddingDate - createdDate) / (1000 * 60 * 60 * 24));
      })
      .filter(days => days > 0 && days < 730); // Filter outliers

    const avgLeadTime = leadTimes.length > 0
      ? Math.round(leadTimes.reduce((sum, days) => sum + days, 0) / leadTimes.length)
      : 0;

    // Calculate tour conversion rate
    const totalSubmissions = allSubmissions.length;
    const submissionsWithTour = allSubmissions.filter(s => s.tour_date).length;
    const tourConversionRate = totalSubmissions > 0
      ? Math.round((submissionsWithTour / totalSubmissions) * 100)
      : 0;

    return Response.json({
      totalVenues: new Set(allWeddings.map(w => w.venue_id)).size,
      totalWeddings: allWeddings.length,
      totalInquiries: allSubmissions.length,
      avgPackagePrice: Math.round(avgPackagePricing),
      popularMonths,
      popularPackages: Object.entries(packageCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([pkg, count]) => ({ package: pkg, count })),
      avgBudget: Math.round(avgBudget),
      avgGuestCount: Math.round(avgGuestCount),
      featureUsage,
      avgBookingLeadTime: avgLeadTime,
      tourConversionRate
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});