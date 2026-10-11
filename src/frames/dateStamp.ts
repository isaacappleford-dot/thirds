/** Date formats for the seven-segment stamp. Pure; unit-tested. */
export type DateFormatId = 'yy-mm-dd' | 'mm-dd-yy' | 'dd-mm-yy';

export const DATE_FORMATS: { id: DateFormatId; label: string }[] = [
  { id: 'yy-mm-dd', label: "'25 10 11" },
  { id: 'mm-dd-yy', label: "10 11 '25" },
  { id: 'dd-mm-yy', label: "11 10 '25" },
];

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The stamp text. The apostrophe before the year mimics 90s camera backs;
 * DSEG7 draws it as a single segment.
 */
export function formatStamp(date: Date, format: DateFormatId): string {
  const yy = `'${pad(date.getFullYear() % 100)}`;
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  switch (format) {
    case 'mm-dd-yy':
      return `${mm} ${dd} ${yy}`;
    case 'dd-mm-yy':
      return `${dd} ${mm} ${yy}`;
    default:
      return `${yy} ${mm} ${dd}`;
  }
}

export function formatLabel(format: DateFormatId, date = new Date()): string {
  return formatStamp(date, format);
}
