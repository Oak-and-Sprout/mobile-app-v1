export function BioCheck({
  checked, onChange, what = 'PIN',
}: { checked: boolean; onChange: (v: boolean) => void; what?: string }) {
  return (
    <label className="fcheck">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span><b>Unlock with Face ID next time</b><small dangerouslySetInnerHTML={{ __html: `Your ${what} lives in this phone&rsquo;s secure keychain - a glance opens the book.` }} /></span>
    </label>
  )
}
