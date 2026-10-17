import { format } from 'date-fns';

// Calendar date in the user's local timezone, as stored in entries.entry_date
export const toDateStr = (date: Date) => format(date, 'yyyy-MM-dd');
