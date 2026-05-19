import { describe, expect, it } from 'vitest';
import {
  SLOT_INTERVAL_MINUTES,
  addMinutes,
  getAvailableSlots,
  slotsOverlap,
  type SlotInput,
} from '../index';

const baseInput = (overrides: Partial<SlotInput> = {}): SlotInput => ({
  date: '2026-06-01',
  workingHours: { startTime: '09:00', endTime: '17:00' },
  isDayOff: false,
  existingBookings: [],
  serviceDurationMinutes: 30,
  nowInBusinessTz: null,
  ...overrides,
});

describe('SLOT_INTERVAL_MINUTES', () => {
  it('is 15', () => {
    expect(SLOT_INTERVAL_MINUTES).toBe(15);
  });
});

describe('addMinutes', () => {
  it('adds minutes within a day', () => {
    expect(addMinutes('09:00', 30)).toBe('09:30');
    expect(addMinutes('09:45', 30)).toBe('10:15');
    expect(addMinutes('23:30', 29)).toBe('23:59');
  });

  it('rejects malformed input', () => {
    expect(() => addMinutes('9:00', 15)).toThrow();
    expect(() => addMinutes('24:00', 0)).toThrow();
    expect(() => addMinutes('12:60', 0)).toThrow();
  });
});

describe('slotsOverlap', () => {
  it('treats adjacent intervals as non-overlapping', () => {
    expect(slotsOverlap('09:00', '09:30', '09:30', '10:00')).toBe(false);
    expect(slotsOverlap('09:30', '10:00', '09:00', '09:30')).toBe(false);
  });

  it('detects identical ranges as overlapping', () => {
    expect(slotsOverlap('09:00', '10:00', '09:00', '10:00')).toBe(true);
  });

  it('detects one range inside another as overlapping', () => {
    expect(slotsOverlap('09:00', '11:00', '09:30', '10:30')).toBe(true);
    expect(slotsOverlap('09:30', '10:30', '09:00', '11:00')).toBe(true);
  });

  it('detects partial overlaps', () => {
    expect(slotsOverlap('09:00', '10:00', '09:45', '10:30')).toBe(true);
    expect(slotsOverlap('09:45', '10:30', '09:00', '10:00')).toBe(true);
  });

  it('detects disjoint ranges as non-overlapping', () => {
    expect(slotsOverlap('09:00', '09:30', '10:00', '10:30')).toBe(false);
  });
});

describe('getAvailableSlots', () => {
  it('returns [] when isDayOff is true', () => {
    expect(getAvailableSlots(baseInput({ isDayOff: true }))).toEqual([]);
  });

  it('returns [] when workingHours is null', () => {
    expect(getAvailableSlots(baseInput({ workingHours: null }))).toEqual([]);
  });

  it('returns expected 15-minute granularity slots for a plain day', () => {
    const slots = getAvailableSlots(
      baseInput({
        workingHours: { startTime: '09:00', endTime: '10:00' },
        serviceDurationMinutes: 30,
      }),
    );
    expect(slots).toEqual(['09:00', '09:15', '09:30']);
  });

  it('drops slots whose end exceeds endTime', () => {
    const slots = getAvailableSlots(
      baseInput({
        workingHours: { startTime: '09:00', endTime: '09:45' },
        serviceDurationMinutes: 30,
      }),
    );
    expect(slots).toEqual(['09:00', '09:15']);
  });

  it('excludes slots overlapping the break window', () => {
    const slots = getAvailableSlots(
      baseInput({
        workingHours: {
          startTime: '09:00',
          endTime: '11:00',
          breakStartTime: '10:00',
          breakEndTime: '10:30',
        },
        serviceDurationMinutes: 30,
      }),
    );
    expect(slots).toEqual(['09:00', '09:15', '09:30', '10:30']);
  });

  it('excludes a service that would span the break', () => {
    const slots = getAvailableSlots(
      baseInput({
        workingHours: {
          startTime: '09:00',
          endTime: '12:00',
          breakStartTime: '10:00',
          breakEndTime: '10:15',
        },
        serviceDurationMinutes: 60,
      }),
    );
    expect(slots).not.toContain('09:30');
    expect(slots).not.toContain('09:45');
    expect(slots).not.toContain('10:00');
    expect(slots).toContain('09:00');
    expect(slots).toContain('10:15');
  });

  it('excludes slots overlapping any existing confirmed booking', () => {
    const slots = getAvailableSlots(
      baseInput({
        workingHours: { startTime: '09:00', endTime: '11:00' },
        existingBookings: [
          { startTime: '09:30', endTime: '10:00' },
          { startTime: '10:30', endTime: '10:45' },
        ],
        serviceDurationMinutes: 30,
      }),
    );
    expect(slots).toEqual(['09:00', '10:00']);
  });

  it('drops slots starting before now on the same business-tz date', () => {
    const slots = getAvailableSlots(
      baseInput({
        date: '2026-06-01',
        workingHours: { startTime: '09:00', endTime: '11:00' },
        serviceDurationMinutes: 30,
        nowInBusinessTz: { date: '2026-06-01', time: '10:05' },
      }),
    );
    expect(slots).toEqual(['10:15', '10:30']);
  });

  it('does not filter when nowInBusinessTz is for a different date', () => {
    const slots = getAvailableSlots(
      baseInput({
        date: '2026-06-02',
        workingHours: { startTime: '09:00', endTime: '10:00' },
        serviceDurationMinutes: 30,
        nowInBusinessTz: { date: '2026-06-01', time: '15:00' },
      }),
    );
    expect(slots).toEqual(['09:00', '09:15', '09:30']);
  });
});
