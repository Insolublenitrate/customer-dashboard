// One place decides how a rejected field reads, so every form says it the same
// way. Renders nothing when the field is valid.
export default function FormError({ error }) {
  if (!error?.message) return null
  return (
    <p className="field-error" role="alert">
      {error.message}
    </p>
  )
}
