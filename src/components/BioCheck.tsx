export function BioCheck({
  checked, onChange, what = 'PIN',
}: { checked: boolean; onChange: (v: boolean) => void; what?: string }) {
  return (
    <label className="fcheck">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span><b>Unlock with Face ID next time</b><small>Your {what} lives in this phone&rsquo;s secure keychain - a glance opens the book.</small></span>
    </label>
  )
}
