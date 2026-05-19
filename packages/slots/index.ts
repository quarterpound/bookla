export const SLOT_INTERVAL_MINUTES = 15;

export interface WorkingHoursInput {
  startTime: string;
  endTime: string;
  breakStartTime?: string;
  breakEndTime?: string;
}

export interface BookingInput {
  startTime: string;
  endTime: string;
}

export interface SlotInput {
  date: string;
  workingHours: WorkingHoursInput | null;
  isDayOff: boolean;
  existingBookings: BookingInput[];
  serviceDurationMinutes: number;
  nowInBusinessTz: { date: string; time: string } | null;
}

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const toMinutes = (hhmm: string): number => {
  const m = HHMM_RE.exec(hhmm);
  if (!m) throw new Error(`Invalid HH:MM value: ${hhmm}`);
  return Number(m[1]) * 60 + Number(m[2]);
};

const fromMinutes = (total: number): string => {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const addMinutes = (hhmm: string, minutes: number): string => {
  return fromMinutes(toMinutes(hhmm) + minutes);
};

export const slotsOverlap = (
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean => {
  const aS = toMinutes(aStart);
  const aE = toMinutes(aEnd);
  const bS = toMinutes(bStart);
  const bE = toMinutes(bEnd);
  return aS < bE && bS < aE;
};

const hasBreak = (
  wh: WorkingHoursInput,
): wh is WorkingHoursInput & { breakStartTime: string; breakEndTime: string } => {
  return (
    typeof wh.breakStartTime === 'string' &&
    typeof wh.breakEndTime === 'string' &&
    wh.breakStartTime !== wh.breakEndTime
  );
};

export const getAvailableSlots = (input: SlotInput): string[] => {
  const { workingHours, isDayOff, existingBookings, serviceDurationMinutes, nowInBusinessTz, date } =
    input;

  if (isDayOff || !workingHours) return [];
  if (!Number.isInteger(serviceDurationMinutes) || serviceDurationMinutes <= 0) return [];

  const dayStart = toMinutes(workingHours.startTime);
  const dayEnd = toMinutes(workingHours.endTime);
  if (dayEnd <= dayStart) return [];

  const breakRange = hasBreak(workingHours)
    ? { start: toMinutes(workingHours.breakStartTime), end: toMinutes(workingHours.breakEndTime) }
    : null;

  const bookings = existingBookings.map((b) => ({
    start: toMinutes(b.startTime),
    end: toMinutes(b.endTime),
  }));

  const minStart =
    nowInBusinessTz && nowInBusinessTz.date === date ? toMinutes(nowInBusinessTz.time) : -1;

  const slots: string[] = [];
  for (let start = dayStart; start + serviceDurationMinutes <= dayEnd; start += SLOT_INTERVAL_MINUTES) {
    const end = start + serviceDurationMinutes;

    if (start < minStart) continue;

    if (breakRange && start < breakRange.end && breakRange.start < end) continue;

    let conflicts = false;
    for (const b of bookings) {
      if (start < b.end && b.start < end) {
        conflicts = true;
        break;
      }
    }
    if (conflicts) continue;

    slots.push(fromMinutes(start));
  }

  return slots;
};
