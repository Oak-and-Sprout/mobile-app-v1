import { useEffect, useState, type ReactNode } from 'react'
import { ErrBox } from '../../components/chrome'
import { Ic } from '../../components/Icons'
import { slugify, validateSlug } from '../../lib/slug'
import { checkSlugAvailability, suggestSlug } from '../../services/wizard'
import WizFrame from './WizFrame'

export interface Step1Deps {
  checkSlugAvailability: typeof checkSlugAvailability
  suggestSlug: typeof suggestSlug
}

const defaultDeps = (): Step1Deps => ({ checkSlugAvailability, suggestSlug })

const UNREACHABLE_MSG = 'Can’t reach that server. Check the address and your connection.'
const GENERIC_INVALID_MSG = 'That link isn’t available - try another.'

type SlugStatus = 'idle' | 'checking' | 'free' | 'blocked'

export default function Step1Family({
  base, busy, error, onCancel, onNext, deps: depsOverride,
}: {
  base: string
  busy: boolean
  error: ReactNode | null
  onCancel: () => void
  onNext: (args: { name: string; slug: string }) => void
  deps?: Partial<Step1Deps>
}) {
  const [deps] = useState<Step1Deps>(() => ({ ...defaultDeps(), ...depsOverride }))
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle')
  const [slugMsg, setSlugMsg] = useState<ReactNode>(null)

  // Debounced availability check: client-side pattern/reserved-word validation runs first
  // (no network round-trip for obviously-bad input), then a 500ms-debounced server check.
  useEffect(() => {
    if (!slug) {
      setSlugStatus('idle')
      setSlugMsg(null)
      return
    }
    const clientCheck = validateSlug(slug)
    if (!clientCheck.ok) {
      setSlugStatus('blocked')
      setSlugMsg(clientCheck.error)
      return
    }
    setSlugStatus('checking')
    const id = setTimeout(() => {
      deps
        .checkSlugAvailability(base, slug)
        .then(result => {
          if (result === 'free') {
            setSlugStatus('free')
            setSlugMsg(null)
          } else if (result === 'taken') {
            setSlugStatus('blocked')
            setSlugMsg(<>Another family already lives at <b>/{slug}</b> - try a different one.</>)
          } else {
            setSlugStatus('blocked')
            setSlugMsg(GENERIC_INVALID_MSG)
          }
        })
        .catch(() => {
          setSlugStatus('blocked')
          setSlugMsg(UNREACHABLE_MSG)
        })
    }, 500)
    return () => clearTimeout(id)
  }, [slug, base, deps])

  function nameChange(v: string) {
    setName(v)
    if (!slugTouched) setSlug(slugify(v))
  }

  function slugChange(v: string) {
    setSlug(v.toLowerCase().replace(/\s+/g, '-'))
    setSlugTouched(true)
  }

  async function regen() {
    setSlugTouched(true)
    const suggestion = await deps.suggestSlug(base)
    setSlug(suggestion ?? `${slugify(name) || 'sprout'}-${Math.floor(100 + Math.random() * 900)}`)
  }

  const ok1 = name.trim() !== '' && slugStatus === 'free'

  return (
    <WizFrame
      step={1}
      title="Create your family."
      intro="Your account is planted - now let&rsquo;s make the page everyone will share."
      footer={
        <>
          <button className="m-btn ghost" disabled={busy} onClick={onCancel}>Cancel</button>
          <button className="m-btn" disabled={!ok1 || busy} onClick={() => onNext({ name: name.trim(), slug })}>
            {busy ? 'Saving your family…' : 'Next'}
          </button>
        </>
      }
    >
      <div className="f-grid">
        <div>
          <label className="fl" htmlFor="wzName">What&rsquo;s your family&rsquo;s name?</label>
          <input
            className="fi" id="wzName" placeholder="The Sprout Family" value={name}
            onChange={e => nameChange(e.target.value)}
          />
        </div>
        <div>
          <label className="fl" htmlFor="wzSlug">Family link</label>
          <div className="slug-row">
            <input
              className="fi" id="wzSlug" autoCapitalize="none" spellCheck={false} placeholder="family-url"
              value={slug} onChange={e => slugChange(e.target.value)}
            />
            <button type="button" title="Suggest another" aria-label="Suggest another link" onClick={() => void regen()}>
              <Ic id="i-refresh" s={18} />
            </button>
          </div>
          <p className="fh slug-note">
            Your family will live at <code>sprout-track.com/{slug || 'your-family-url'}</code> - lowercase letters,
            numbers, and hyphens.
          </p>
        </div>
        {error ? (
          <ErrBox>{error}</ErrBox>
        ) : slugStatus === 'checking' ? (
          <div className="slug-checking">
            <span className="dots" style={{ margin: 0 }}><i></i><i></i><i></i></span>
            Checking if that link is free…
          </div>
        ) : slugStatus === 'free' ? (
          <div className="slug-ok">
            <Ic id="i-check" s={15} />
            <span><code>/{slug}</code> is free - it&rsquo;s yours.</span>
          </div>
        ) : slugStatus === 'blocked' ? (
          <ErrBox>{slugMsg}</ErrBox>
        ) : null}
      </div>
    </WizFrame>
  )
}
