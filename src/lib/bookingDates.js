import { format } from 'date-fns';
export const bookingEnd = booking => booking.end_date || booking.date;
export const bookingCovers = (booking, date) => !booking.merged_into_id && booking.date <= date && bookingEnd(booking) >= date;
export const activeBookings = rows => rows.filter(row => !row.merged_into_id);
export function bookingLabel(booking) {
  const start = format(new Date(booking.date + 'T00:00:00'), 'MMM d, yyyy');
  return bookingEnd(booking) === booking.date ? start : start + ' – ' + format(new Date(bookingEnd(booking) + 'T00:00:00'), 'MMM d, yyyy');
}
