import { describe, expect, it } from 'vitest';
import { formatStamp } from './dateStamp';

describe('formatStamp', () => {
  const d = new Date(1998, 6, 4); // 4 July 1998, local time
  it('formats year-first', () => expect(formatStamp(d, 'yy-mm-dd')).toBe("'98 07 04"));
  it('formats month-first', () => expect(formatStamp(d, 'mm-dd-yy')).toBe("07 04 '98"));
  it('formats day-first', () => expect(formatStamp(d, 'dd-mm-yy')).toBe("04 07 '98"));
  it('pads 2000s years', () => expect(formatStamp(new Date(2003, 0, 9), 'yy-mm-dd')).toBe("'03 01 09"));
});
