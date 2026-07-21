import { useState, type ReactNode } from 'react'
import { ErrBox } from '../../components/chrome'
import { FEED_TYPE_OPTIONS, type BabyConfig } from '../../services/wizard'
import WizFrame from './WizFrame'

const hhmm = (v: string) => /^\d{2}:\d{2}$/.test(v)

export default function Step3Baby({
  busy, error, onComplete,
}: {
  busy: boolean
  error: ReactNode | null
  onComplete: (baby: BabyConfig) => void
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState<'' | 'MALE' | 'FEMALE'>('')
  const [feedWarningTime, setFeedWarningTime] = useState('02:00')
  const [diaperWarningTime, setDiaperWarningTime] = useState('03:00')
  const [feedTimerFrom, setFeedTimerFrom] = useState<'start' | 'end'>('start')
  const [feeds, setFeeds] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(FEED_TYPE_OPTIONS.map(o => [o.category, true])),
  )

  const ok3 =
    firstName.trim() !== '' &&
    lastName.trim() !== '' &&
    birthDate !== '' &&
    gender !== '' &&
    hhmm(feedWarningTime) &&
    hhmm(diaperWarningTime)

  function submit() {
    if (gender === '') return
    onComplete({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthDate,
      gender,
      feedWarningTime,
      diaperWarningTime,
      feedTimerFrom,
      feedTimerCategories: FEED_TYPE_OPTIONS.filter(o => feeds[o.category]).map(o => o.category),
    })
  }

  return (
    <WizFrame
      step={3}
      savedNote="Security saved"
      title="Add your baby."
      intro="Now the star of the book. You can change any of this later."
      footer={
        <button className="m-btn" disabled={!ok3 || busy} onClick={submit}>
          {busy ? 'Planting your sprout…' : 'Complete setup'}
        </button>
      }
    >
      <div className="f-grid">
        <div className="f-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <label className="fl" htmlFor="wzBF">First name</label>
            <input className="fi" id="wzBF" placeholder="Jackson" value={firstName} onChange={e => setFirstName(e.target.value)} />
          </div>
          <div>
            <label className="fl" htmlFor="wzBL">Last name</label>
            <input className="fi" id="wzBL" placeholder="Sprout" value={lastName} onChange={e => setLastName(e.target.value)} />
          </div>
        </div>
        <div className="f-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <label className="fl" htmlFor="wzDob">Birth date</label>
            <input className="fi" id="wzDob" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
          </div>
          <div>
            <label className="fl" htmlFor="wzGen">Gender</label>
            <select
              className="fi" id="wzGen" value={gender}
              onChange={e => setGender(e.target.value as '' | 'MALE' | 'FEMALE')}
            >
              <option value="">Choose…</option>
              <option value="MALE">Boy</option>
              <option value="FEMALE">Girl</option>
            </select>
          </div>
        </div>
        <div className="fgroup">
          <b>Gentle nudges</b>
          <p className="fh">Sprout Track quietly warns whoever&rsquo;s on duty when it&rsquo;s been this long. Format: hh:mm.</p>
          <div className="f-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label className="fl" htmlFor="wzFeed">Since last feed</label>
              <input className="fi" id="wzFeed" placeholder="02:00" value={feedWarningTime} onChange={e => setFeedWarningTime(e.target.value)} />
              {feedWarningTime && !hhmm(feedWarningTime) && <p className="fi-err">Use hh:mm, like 02:00.</p>}
            </div>
            <div>
              <label className="fl" htmlFor="wzDiap">Since last diaper</label>
              <input className="fi" id="wzDiap" placeholder="03:00" value={diaperWarningTime} onChange={e => setDiaperWarningTime(e.target.value)} />
              {diaperWarningTime && !hhmm(diaperWarningTime) && <p className="fi-err">Use hh:mm, like 03:00.</p>}
            </div>
          </div>
        </div>
        <div>
          <label className="fl" htmlFor="wzFrom">Feed timer counts from</label>
          <select
            className="fi" id="wzFrom" value={feedTimerFrom}
            onChange={e => setFeedTimerFrom(e.target.value as 'start' | 'end')}
          >
            <option value="start">Start of feeding</option>
            <option value="end">End of feeding</option>
          </select>
        </div>
        <div>
          <label className="fl">Which feeds reset the timer?</label>
          <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
            {FEED_TYPE_OPTIONS.map(o => (
              <label className="fcheck" key={o.category}>
                <input
                  type="checkbox" checked={feeds[o.category]}
                  onChange={e => setFeeds(v => ({ ...v, [o.category]: e.target.checked }))}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </div>
        {error && <ErrBox>{error}</ErrBox>}
      </div>
    </WizFrame>
  )
}
