/**
 * Simple Cron Parser
 * Calculates next occurrences of a cron expression in IST (UTC+5:30)
 */

export interface CronNextOccurrences {
  occurrences: Date[];
  isValid: boolean;
  error?: string;
}

/**
 * Get IST time components from a UTC date
 */
function getISTComponents(utcDate: Date) {
  // IST is UTC+5:30
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(utcDate.getTime() + istOffsetMs);
  
  return {
    minute: istDate.getUTCMinutes(),
    hour: istDate.getUTCHours(),
    day: istDate.getUTCDate(),
    month: istDate.getUTCMonth() + 1, // getUTCMonth() returns 0-11
    weekday: istDate.getUTCDay(), // 0 = Sunday, 6 = Saturday
    year: istDate.getUTCFullYear(),
  };
}

/**
 * Create UTC date from IST components
 */
function createUTCFromIST(istMinute: number, istHour: number, istDay: number, istMonth: number, istYear: number): Date {
  // Create a date in UTC that represents the IST time
  // We'll create it as if it's IST, then subtract the offset
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const tempDate = new Date(Date.UTC(istYear, istMonth - 1, istDay, istHour, istMinute, 0, 0));
  // Subtract IST offset to get UTC
  return new Date(tempDate.getTime() - istOffsetMs);
}

/**
 * Parse cron expression and get next N occurrences in IST
 * Format: minute hour day month weekday
 * Examples:
 * - "0 9 * * *" - Daily at 9 AM IST
 * - "0 0 * * 0" - Weekly on Sunday at midnight IST
 * - "0 0 1 * *" - Monthly on the 1st at midnight IST
 * - Every 30 minutes: use asterisk-slash-30 format (e.g., *\/30 * * * *)
 */
export function getCronNextOccurrences(
  cronExpression: string,
  count: number = 3
): CronNextOccurrences {
  try {
    const parts = cronExpression.trim().split(/\s+/);
    
    if (parts.length !== 5) {
      return {
        occurrences: [],
        isValid: false,
        error: 'Cron expression must have 5 parts: minute hour day month weekday',
      };
    }

    const [minute, hour, day, month, weekday] = parts;

    // Validate and parse each part
    const minuteValues = parseCronPart(minute, 0, 59);
    const hourValues = parseCronPart(hour, 0, 23);
    const dayValues = parseCronPart(day, 1, 31);
    const monthValues = parseCronPart(month, 1, 12);
    const weekdayValues = parseCronPart(weekday, 0, 6); // 0 = Sunday, 6 = Saturday

    if (
      minuteValues === null ||
      hourValues === null ||
      dayValues === null ||
      monthValues === null ||
      weekdayValues === null
    ) {
      return {
        occurrences: [],
        isValid: false,
        error: 'Invalid cron expression format',
      };
    }

    // Start from current time in IST
    const now = new Date();
    const istNow = getISTComponents(now);
    
    // Start from next minute in IST
    let currentIST = {
      minute: istNow.minute + 1,
      hour: istNow.hour,
      day: istNow.day,
      month: istNow.month,
      year: istNow.year,
      weekday: istNow.weekday,
    };

    // Normalize if minute >= 60
    if (currentIST.minute >= 60) {
      currentIST.minute = 0;
      currentIST.hour += 1;
    }
    if (currentIST.hour >= 24) {
      currentIST.hour = 0;
      currentIST.day += 1;
    }

    const occurrences: Date[] = [];
    const maxIterations = 10000; // Prevent infinite loops
    let iterations = 0;

    while (occurrences.length < count && iterations < maxIterations) {
      iterations++;

      // Check if current IST time matches cron expression
      if (
        minuteValues.includes(currentIST.minute) &&
        hourValues.includes(currentIST.hour) &&
        dayValues.includes(currentIST.day) &&
        monthValues.includes(currentIST.month) &&
        weekdayValues.includes(currentIST.weekday)
      ) {
        // Convert IST to UTC for storage
        const utcDate = createUTCFromIST(
          currentIST.minute,
          currentIST.hour,
          currentIST.day,
          currentIST.month,
          currentIST.year
        );
        occurrences.push(utcDate);
      }

      // Move to next minute in IST
      currentIST.minute += 1;
      if (currentIST.minute >= 60) {
        currentIST.minute = 0;
        currentIST.hour += 1;
        if (currentIST.hour >= 24) {
          currentIST.hour = 0;
          currentIST.day += 1;
          currentIST.weekday = (currentIST.weekday + 1) % 7;
          
          // Handle month/year rollover (simplified)
          const daysInMonth = new Date(currentIST.year, currentIST.month, 0).getDate();
          if (currentIST.day > daysInMonth) {
            currentIST.day = 1;
            currentIST.month += 1;
            if (currentIST.month > 12) {
              currentIST.month = 1;
              currentIST.year += 1;
            }
          }
        }
      }
    }

    if (iterations >= maxIterations) {
      return {
        occurrences,
        isValid: false,
        error: 'Could not find enough occurrences (may be invalid expression)',
      };
    }

    return {
      occurrences,
      isValid: true,
    };
  } catch (error) {
    return {
      occurrences: [],
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown error parsing cron',
    };
  }
}

/**
 * Parse a single cron part (minute, hour, day, month, weekday)
 * Supports: *, number, range (1-5), list (1,3,5), step (asterisk-slash format, e.g., *\/5, 1-10/2)
 */
function parseCronPart(part: string, min: number, max: number): number[] | null {
  if (part === '*') {
    // All values
    return Array.from({ length: max - min + 1 }, (_, i) => i + min);
  }

  // Handle step values (e.g., */5, 1-10/2)
  if (part.includes('/')) {
    const [range, stepStr] = part.split('/');
    const step = parseInt(stepStr, 10);
    
    if (isNaN(step) || step <= 0) {
      return null;
    }

    let values: number[];
    if (range === '*') {
      values = Array.from({ length: max - min + 1 }, (_, i) => i + min);
    } else if (range.includes('-')) {
      const [start, end] = range.split('-').map(n => parseInt(n, 10));
      if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
        return null;
      }
      values = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    } else {
      const num = parseInt(range, 10);
      if (isNaN(num) || num < min || num > max) {
        return null;
      }
      values = [num];
    }

    return values.filter((_, i) => i % step === 0);
  }

  // Handle ranges (e.g., 1-5)
  if (part.includes('-')) {
    const [start, end] = part.split('-').map(n => parseInt(n, 10));
    if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
      return null;
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  // Handle lists (e.g., 1,3,5)
  if (part.includes(',')) {
    const values = part.split(',').map(n => parseInt(n.trim(), 10));
    if (values.some(v => isNaN(v) || v < min || v > max)) {
      return null;
    }
    return values;
  }

  // Single number
  const value = parseInt(part, 10);
  if (isNaN(value) || value < min || value > max) {
    return null;
  }
  return [value];
}

/**
 * Format date in IST timezone for display
 */
export function formatISTDate(date: Date): string {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffsetMs);
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const day = days[istDate.getUTCDay()];
  const month = months[istDate.getUTCMonth()];
  const dateNum = istDate.getUTCDate();
  const year = istDate.getUTCFullYear();
  const hour = istDate.getUTCHours();
  const minute = istDate.getUTCMinutes();
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  const minuteStr = minute.toString().padStart(2, '0');
  
  return `${day}, ${month} ${dateNum}, ${year} at ${hour12}:${minuteStr} ${ampm} IST`;
}
