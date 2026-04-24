import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import {
  datetimeLocalStringToDate,
  dateToDatetimeLocalString,
} from '../../utils/interruptionFormUtils';
import 'react-datepicker/dist/react-datepicker.css';

const HOURS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function isSameCalendarDay(d1, d2) {
  if (!d1 || !d2) return false;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function to24h(hour12, pm) {
  if (pm && hour12 < 12) return hour12 + 12;
  if (!pm && hour12 === 12) return 0;
  return hour12;
}

/**
 * In-modal date + time picker. Date from calendar (no portal), time from manual input + AM/PM.
 * Output: YYYY-MM-DDTHH:mm (datetime-local format).
 * When futureOnly=true, prevents past dates and times (for "Goes live at" scheduling).
 * When strictlyAfter is set (e.g. ERT), the chosen instant must be strictly after that time;
 *   values on or before it are nudged to the next full minute.
 */
export default function InModalDateTimePicker({
  value,
  onChange,
  required,
  disabled,
  placeholder = 'Select date and time',
  id,
  futureOnly = false,
  strictlyAfter = null,
}) {
  const now = new Date();
  const startOfLocalDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today0 = startOfLocalDay(new Date());
  const minDate =
    futureOnly || strictlyAfter
      ? (() => {
          const ert0 = strictlyAfter ? startOfLocalDay(strictlyAfter) : null;
          if (futureOnly && ert0) {
            return new Date(Math.max(today0.getTime(), ert0.getTime()));
          }
          if (futureOnly) return today0;
          if (ert0) return ert0;
          return null;
        })()
      : null;

  const parsed = datetimeLocalStringToDate(value);
  const [datePart, setDatePart] = useState(parsed || null);
  const [hour, setHour] = useState(
    parsed ? String((parsed.getHours() % 12) || 12) : '12'
  );
  const [minuteStr, setMinuteStr] = useState(
    parsed ? String(parsed.getMinutes()).padStart(2, '0') : '00'
  );
  const [pm, setPm] = useState(parsed ? parsed.getHours() >= 12 : false);

  useEffect(() => {
    const p = datetimeLocalStringToDate(value);
    if (p) {
      if (futureOnly && p.getTime() <= now.getTime()) {
        /* Don't auto-correct on load - that would mark form as dirty when user didn't change anything. */
        setDatePart(p);
        setHour(String((p.getHours() % 12) || 12));
        setMinuteStr(String(p.getMinutes()).padStart(2, '0'));
        setPm(p.getHours() >= 12);
        return;
      }
      setDatePart(p);
      setHour(String((p.getHours() % 12) || 12));
      setMinuteStr(String(p.getMinutes()).padStart(2, '0'));
      setPm(p.getHours() >= 12);
    } else {
      setDatePart(null);
      setHour('12');
      setMinuteStr('00');
      setPm(false);
    }
  }, [value]);

  const getValueToEmit = (nextDate, nextHour, nextMin, nextPm) => {
    if (!nextDate) return '';
    const h = parseInt(nextHour, 10) || 12;
    const m = parseInt(nextMin, 10) || 0;
    let hour24 = h;
    if (nextPm && h < 12) hour24 = h + 12;
    else if (!nextPm && h === 12) hour24 = 0;
    let combined = new Date(
      nextDate.getFullYear(),
      nextDate.getMonth(),
      nextDate.getDate(),
      hour24,
      m,
      0,
      0
    );
    if (strictlyAfter && combined.getTime() <= strictlyAfter.getTime()) {
      combined = new Date(strictlyAfter.getTime() + 60 * 1000);
    }
    if (futureOnly && combined.getTime() <= now.getTime()) {
      const soonest = new Date(now.getTime() + 60000);
      return dateToDatetimeLocalString(soonest);
    }
    return dateToDatetimeLocalString(combined);
  };

  const handleDateChange = (d) => {
    setDatePart(d);
    if (d) {
      const val = getValueToEmit(d, hour, minuteStr, pm);
      onChange(val);
    } else {
      onChange('');
    }
  };

  const hour24Selected = to24h(parseInt(hour, 10) || 12, pm);
  const nowHour24 = now.getHours();
  const nowMinute = now.getMinutes();
  const isTodayAndFutureOnly = futureOnly && datePart && isSameCalendarDay(datePart, now);
  const needsMinuteFilter =
    isTodayAndFutureOnly && hour24Selected === nowHour24;
  const allowedMinutes = needsMinuteFilter
    ? MINUTES.filter((m) => parseInt(m, 10) >= nowMinute)
    : MINUTES;

  useEffect(() => {
    if (
      futureOnly &&
      allowedMinutes.length > 0 &&
      !allowedMinutes.includes(minuteStr) &&
      datePart
    ) {
      const correctedMin = allowedMinutes[0];
      const val = getValueToEmit(datePart, hour, correctedMin, pm);
      onChange(val);
    }
  }, [futureOnly, allowedMinutes, minuteStr, datePart, hour, pm]);

  const handleTimeChange = (field, val) => {
    if (field === 'hour') setHour(val);
    if (field === 'minute') setMinuteStr(val);
    if (field === 'pm') setPm(val);
    const nextDate = datePart;
    const nextHour = field === 'hour' ? val : hour;
    const nextMin = field === 'minute' ? val : minuteStr;
    const nextPm = field === 'pm' ? val : pm;
    if (nextDate) {
      const valToEmit = getValueToEmit(nextDate, nextHour, nextMin, nextPm);
      onChange(valToEmit);
    }
  };

  return (
    <div className="interruptions-admin-inmodal-datetime">
      <DatePicker
        id={id}
        selected={datePart || datetimeLocalStringToDate(value)}
        onChange={handleDateChange}
        dateFormat="MMM d, yyyy"
        placeholderText={placeholder}
        required={required}
        disabled={disabled}
        minDate={minDate}
        className="interruptions-admin-datetime-input"
        withPortal={false}
        popperPlacement="bottom-start"
        popperModifiers={[
          {
            name: 'preventOverflow',
            options: { rootBoundary: 'viewport', padding: 8 },
          },
        ]}
      />
      <div className="interruptions-admin-inmodal-time-row">
        <select
          value={hour}
          onChange={(e) => handleTimeChange('hour', e.target.value)}
          disabled={disabled}
          className="interruptions-admin-inmodal-time-select"
          aria-label="Hour"
        >
          {HOURS_12.map((h) => (
            <option key={h} value={String(h)}>
              {h}
            </option>
          ))}
        </select>
        <span className="interruptions-admin-inmodal-time-sep">:</span>
        <select
          value={allowedMinutes.includes(minuteStr) ? minuteStr : (allowedMinutes[0] || '00')}
          onChange={(e) => handleTimeChange('minute', e.target.value)}
          disabled={disabled}
          className="interruptions-admin-inmodal-time-select"
          aria-label="Minute"
        >
          {allowedMinutes.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <div className="interruptions-admin-inmodal-ampm" role="group" aria-label="AM/PM">
          <label className="interruptions-admin-radio-line">
            <input
              type="radio"
              name={`ampm-${id || 'dt'}`}
              checked={!pm}
              onChange={() => handleTimeChange('pm', false)}
              disabled={disabled}
            />
            <span>AM</span>
          </label>
          <label className="interruptions-admin-radio-line">
            <input
              type="radio"
              name={`ampm-${id || 'dt'}`}
              checked={pm}
              onChange={() => handleTimeChange('pm', true)}
              disabled={disabled}
            />
            <span>PM</span>
          </label>
        </div>
      </div>
    </div>
  );
}
