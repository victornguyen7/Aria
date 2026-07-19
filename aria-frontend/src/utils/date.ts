// Backend datetimes round-trip through SQLite as naive values, so the API
// returns ISO strings with no "Z"/offset even though they represent UTC
// instants. Parsing them with `new Date(str)` directly makes JS read them as
// local time, shifting the date near timezone/midnight boundaries. Treat any
// offset-less string as UTC before constructing a Date.
export function parseServerDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const hasTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(value);
  return new Date(hasTimezone ? value : `${value}Z`);
}
