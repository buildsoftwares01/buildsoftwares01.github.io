// Keep calendar validation shared between the invitation and release checks.
export function getEventDate(event) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date || '')) return null;
  const calendarDay = new Date(`${event.date}T00:00:00Z`);
  if (Number.isNaN(calendarDay.getTime()) || calendarDay.toISOString().slice(0, 10) !== event.date) return null;
  if (event.time != null && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(event.time)) return null;
  if (event.utcOffset !== '+04:00') return null;
  return new Date(`${event.date}T${event.time || '12:00'}:00${event.utcOffset}`);
}

export function getReadinessIssues(event) {
  const issues = [];
  if (!event.date) issues.push('Confirm the party date: Sunday 6 or Monday 7 December 2026.');
  else if (!getEventDate({ ...event, time: null })) issues.push('Enter a valid calendar date in YYYY-MM-DD format (Mauritius UTC+04:00).');
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(event.time || '')) issues.push('Enter the start time in HH:mm format, Mauritius time.');
  if (!/^[1-9]\d{7,14}$/.test(event.whatsappNumber || '')) issues.push('Enter the WhatsApp RSVP number with country code, digits only.');
  return issues;
}
