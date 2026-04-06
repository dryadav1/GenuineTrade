export default function FormField({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  rows = 0,
  error = ""
}) {
  return (
    <div className={`group ${error ? "shake-error" : ""}`}>
      <label className="label" htmlFor={name}>
        <span>{label}</span>
        {required ? (
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/38">
            Required
          </span>
        ) : null}
      </label>
      <div className="relative">
        {rows > 0 ? (
          <textarea
            aria-invalid={Boolean(error)}
            id={name}
            name={name}
            className="field min-h-28 resize-y"
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            rows={rows}
            value={value}
          />
        ) : (
          <input
            aria-invalid={Boolean(error)}
            id={name}
            name={name}
            className="field"
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            type={type}
            value={value}
          />
        )}
        <span className="pointer-events-none absolute inset-x-4 bottom-0 h-px origin-left scale-x-0 bg-gradient-to-r from-primary/0 via-accent to-primary/0 transition duration-300 group-focus-within:scale-x-100" />
      </div>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
