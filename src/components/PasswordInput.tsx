// =============================================================================
// PasswordInput — password field with a lucide eye / eye-off toggle.
// The toggle is a 44px button inside the field; it is type="button" with
// onMouseDown preventDefault so the input keeps focus (and the caret), and the
// input keeps its autoComplete value so browser autofill still works.
// =============================================================================

import { useState, type InputHTMLAttributes } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "value" | "className"> {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export default function PasswordInput({ id, label, value, onChange, ...rest }: PasswordInputProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="cs-field-label">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="cs-input pr-12"
          {...rest}
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
          title={visible ? t("auth.hidePassword") : t("auth.showPassword")}
          aria-pressed={visible}
          className="absolute right-0 top-0 flex h-full min-h-[44px] w-11 items-center justify-center text-ink-3 hover:text-ink"
          data-testid={`${id}-toggle`}
        >
          {visible ? <EyeOff size={18} strokeWidth={2} aria-hidden="true" /> : <Eye size={18} strokeWidth={2} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
