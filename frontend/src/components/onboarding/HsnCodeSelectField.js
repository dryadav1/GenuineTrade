"use client";

import Select from "react-select";
import { selectStyles } from "@/components/onboarding/selectStyles";
import { hsnOptions } from "@/lib/hsnOptions";

const filterOption = (candidate, input) => {
  const query = input.toLowerCase().trim();

  if (!query) {
    return true;
  }

  return (
    candidate.data.code.toLowerCase().includes(query) ||
    candidate.data.productName.toLowerCase().includes(query) ||
    candidate.label.toLowerCase().includes(query)
  );
};

export default function HsnCodeSelectField({
  value,
  onChange,
  error = ""
}) {
  const selectedOption = hsnOptions.find((option) => option.code === value) || null;

  return (
    <div>
      <label className="label">HSN Code</label>
      <Select
        filterOption={filterOption}
        instanceId="hsn-code-select"
        isClearable
        isSearchable
        noOptionsMessage={({ inputValue }) =>
          inputValue ? "No HSN match found" : "Type a product or HSN code"
        }
        onChange={(option) => onChange(option || null)}
        options={hsnOptions}
        placeholder="Search by product name or HSN code"
        styles={selectStyles}
        value={selectedOption}
        formatOptionLabel={(option) => (
          <div className="flex flex-col">
            <span className="font-semibold text-ink">{option.code}</span>
            <span className="text-sm text-muted">{option.productName}</span>
          </div>
        )}
      />
      <p className="mt-2 text-xs leading-6 text-muted">
        Start typing "Turmeric" or "091030" to find a matching HSN suggestion.
      </p>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
