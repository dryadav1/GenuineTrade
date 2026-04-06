"use client";

import PhoneInput from "react-phone-input-2";

const normalizeDigits = (value = "") => String(value).replace(/\D/g, "");

export const isValidPhoneValue = (value = "") => {
  if (!value || !String(value).startsWith("+")) {
    return false;
  }

  const digits = normalizeDigits(value);
  return digits.length >= 8 && digits.length <= 15;
};

export default function PhoneNumberField({
  value,
  onChange,
  error = ""
}) {
  const normalizedValue = normalizeDigits(value);

  return (
    <div>
      <label className="label" htmlFor="phone-input">
        Phone
      </label>
      <PhoneInput
        autocompleteSearch
        buttonClass="gt-phone-button"
        containerClass="gt-phone-container"
        country="in"
        countryCodeEditable={false}
        disableSearchIcon
        dropdownClass="gt-phone-dropdown"
        enableSearch
        inputClass="gt-phone-input"
        inputProps={{
          id: "phone-input",
          name: "phone",
          required: true
        }}
        onChange={(phoneValue) => onChange(phoneValue ? `+${phoneValue}` : "")}
        placeholder="9876543210"
        searchClass="gt-phone-search"
        specialLabel=""
        value={normalizedValue}
      />
      <p className="mt-2 text-xs leading-6 text-muted">
        Select the country code and enter the business contact number.
      </p>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
