import React from 'react';
import DatePicker from 'react-datepicker';
import { datetimeLocalStringToDate, dateToDatetimeLocalString } from '../../utils/interruptionFormUtils';
import 'react-datepicker/dist/react-datepicker.css';
import '../../CSS/BulletinDatetimePicker.css';

const BULLETIN_PORTAL_ID = 'interruptions-datepicker-portal';

const CustomInput = React.forwardRef(function BulletinDatetimeCustomInput(
  { value, onClick, disabled, id, required, placeholder },
  ref
) {
  return (
    <input
      ref={ref}
      type="text"
      id={id}
      readOnly
      disabled={disabled}
      required={required}
      className="interruptions-admin-datetime-input"
      value={value || ''}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(e);
        }
      }}
      placeholder={placeholder}
      aria-haspopup="dialog"
      autoComplete="off"
    />
  );
});

/**
 * In-DOM date+time picker for public bulletin scheduling (replaces native datetime-local popup,
 * which cannot be sized for 320px). Value is datetime-local string YYYY-MM-DDTHH:mm.
 */
export default function BulletinDatetimePicker({ id, value, onChange, required, disabled }) {
  const selected = datetimeLocalStringToDate(value);

  return (
    <DatePicker
      id={id}
      selected={selected}
      onChange={(date) => onChange(dateToDatetimeLocalString(date))}
      showTimeSelect
      timeIntervals={15}
      dateFormat="yyyy-MM-dd HH:mm"
      placeholderText="Tap to choose date & time"
      required={required}
      disabled={disabled}
      customInput={<CustomInput />}
      calendarClassName="interruptions-admin-bulletin-datepicker"
      withPortal
      portalId={BULLETIN_PORTAL_ID}
      shouldCloseOnSelect={false}
    />
  );
}

CustomInput.displayName = 'BulletinDatetimeCustomInput';
