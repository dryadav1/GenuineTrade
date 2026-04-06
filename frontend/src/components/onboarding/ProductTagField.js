"use client";

import CreatableSelect from "react-select/creatable";
import { selectStyles } from "@/components/onboarding/selectStyles";

const defaultSuggestions = [
  "Turmeric",
  "Rice",
  "Spices",
  "Tea",
  "Coffee Beans",
  "Sesame Seeds",
  "Cotton",
  "Textiles",
  "Chemicals",
  "Packaging",
  "Machinery",
  "Pulses"
].map((item) => ({
  value: item,
  label: item
}));

export default function ProductTagField({
  label,
  value = [],
  onChange,
  placeholder = "Type product and press enter",
  error = "",
  helper = ""
}) {
  const normalizedValue = value.map((item) => ({
    value: item,
    label: item
  }));

  return (
    <div>
      <label className="label">{label}</label>
      <CreatableSelect
        instanceId={`${label}-tag-select`}
        isMulti
        noOptionsMessage={({ inputValue }) =>
          inputValue ? "Press enter to create this product" : "Type to search or create"
        }
        onChange={(selected) =>
          onChange((selected || []).map((option) => option.value.trim()).filter(Boolean))
        }
        options={defaultSuggestions}
        placeholder={placeholder}
        styles={selectStyles}
        value={normalizedValue}
        formatCreateLabel={(inputValue) => `Add "${inputValue}"`}
      />
      {helper ? <p className="mt-2 text-xs leading-6 text-muted">{helper}</p> : null}
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
