"use client";

import Select from "react-select";
import { countryOptions } from "@/lib/countryOptions";
import { selectStyles } from "@/components/onboarding/selectStyles";

export default function CountrySelectField({
  label,
  value,
  onChange,
  placeholder = "Search country",
  error = ""
}) {
  const selectedOption =
    countryOptions.find((option) => option.value === value) || null;

  return (
    <div>
      <label className="label">{label}</label>
      <Select
        instanceId="country-select"
        isClearable
        isSearchable
        noOptionsMessage={({ inputValue }) =>
          inputValue ? "No matching countries" : "Start typing a country"
        }
        onChange={(option) => onChange(option?.value || "")}
        options={countryOptions}
        placeholder={placeholder}
        styles={selectStyles}
        value={selectedOption}
        formatOptionLabel={(option) => (
          <div className="flex items-center gap-3">
            <span className="text-base">{option.flag}</span>
            <span>{option.label}</span>
          </div>
        )}
      />
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
