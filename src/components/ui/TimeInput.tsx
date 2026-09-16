import * as React from "react";
import { Input } from "@/components/ui/Input";
import { toTimeInputValue } from "@/lib/dates";

type TimeInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode">;

/**
 * 24-hour time entry (`HH:mm`).
 * Prefer this over `<input type="time">`, which follows the OS locale and may show AM/PM.
 */
export const TimeInput = React.forwardRef<HTMLInputElement, TimeInputProps>(
  ({ defaultValue, value, onBlur, onChange, placeholder = "HH:mm", ...props }, ref) => {
    const resolvedDefault =
      defaultValue === undefined
        ? undefined
        : toTimeInputValue(defaultValue == null ? "" : String(defaultValue));
    // Do not normalize controlled `value` on every keystroke — that clears partial input.
    const resolvedValue = value === undefined ? undefined : value == null ? "" : String(value);

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        pattern="([01]\d|2[0-3]):[0-5]\d"
        title="Enter time in 24-hour format as HH:mm (e.g. 13:30)"
        defaultValue={resolvedDefault}
        value={resolvedValue}
        onChange={onChange}
        onBlur={(event) => {
          const normalized = toTimeInputValue(event.currentTarget.value);
          if (normalized && event.currentTarget.value !== normalized) {
            event.currentTarget.value = normalized;
            onChange?.({
              ...event,
              target: event.currentTarget,
              currentTarget: event.currentTarget,
            } as React.ChangeEvent<HTMLInputElement>);
          }
          onBlur?.(event);
        }}
      />
    );
  }
);
TimeInput.displayName = "TimeInput";
