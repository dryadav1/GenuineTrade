export const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 52,
    borderRadius: 16,
    borderColor: state.isFocused ? "#0B3C5D" : "#E6EAF1",
    boxShadow: state.isFocused ? "0 0 0 4px rgba(11, 60, 93, 0.10)" : "0 8px 24px rgba(11, 60, 93, 0.04)",
    backgroundColor: "#FFFFFF",
    paddingLeft: 6,
    transition: "all 160ms ease",
    "&:hover": {
      borderColor: "#0B3C5D"
    }
  }),
  valueContainer: (base) => ({
    ...base,
    paddingTop: 6,
    paddingBottom: 6
  }),
  placeholder: (base) => ({
    ...base,
    color: "#667085"
  }),
  input: (base) => ({
    ...base,
    color: "#081C2A"
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 18,
    overflow: "hidden",
    boxShadow: "0 18px 45px rgba(11, 60, 93, 0.12)",
    border: "1px solid #E6EAF1"
  }),
  menuList: (base) => ({
    ...base,
    paddingTop: 8,
    paddingBottom: 8
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? "rgba(11, 60, 93, 0.06)" : state.isSelected ? "#0B3C5D" : "#FFFFFF",
    color: state.isSelected ? "#FFFFFF" : "#081C2A",
    padding: "12px 14px",
    cursor: "pointer"
  }),
  multiValue: (base) => ({
    ...base,
    borderRadius: 9999,
    backgroundColor: "rgba(11, 60, 93, 0.08)",
    paddingLeft: 6
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: "#0B3C5D",
    fontWeight: 600
  }),
  multiValueRemove: (base) => ({
    ...base,
    borderRadius: 9999,
    color: "#0B3C5D",
    ":hover": {
      backgroundColor: "rgba(11, 60, 93, 0.14)",
      color: "#0B3C5D"
    }
  }),
  indicatorSeparator: () => ({
    display: "none"
  }),
  dropdownIndicator: (base) => ({
    ...base,
    color: "#0B3C5D"
  })
};
