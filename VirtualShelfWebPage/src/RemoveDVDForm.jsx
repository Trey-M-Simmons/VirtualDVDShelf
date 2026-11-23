import { useRef, useState } from 'react'

function RemoveDVDForm({ baseURL, userName, dvd, onRemoved, onOperationError }) {
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const submittingRef = useRef(false)
  const [target, setTarget] = useState(null)

  function requestConfirmation() {
    setTarget(dvd)
    setConfirming(true)
    setError('')
    setSuccess('')
  }

  async function removeDVD() {
    if (!target || submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch(
        `${baseURL}/api/dvds/user/${encodeURIComponent(userName)}/${encodeURIComponent(target.id)}`,
        { method: 'DELETE' },
      )
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(typeof body?.detail === 'string' ? body.detail : `Request failed (${response.status}).`)
      }
      onRemoved(target.id)
      setConfirming(false)
      setSuccess(`Removed "${target.title}" from your shelf.`)
      setTarget(null)
    } catch (requestError) {
      console.error('Failed to remove DVD:', requestError)
      setError(requestError.message || 'Failed to remove DVD. Please try again.')
      onOperationError(requestError.message || 'Failed to remove DVD.')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const confirmationCurrent = target && dvd?.id === target.id

  return (
    <div className="remove-dvd" aria-live="polite">
      {confirming ? (
        confirmationCurrent ? <>
          <p>Remove <strong>{target.title}</strong> from {userName}&apos;s shelf?</p>
          <p className="add-dvd-hint">The DVD and its textures will remain in the shared catalog.</p>
          <div className="remove-dvd-buttons">
            <button type="button" className="add-dvd-submit remove-dvd-confirm" disabled={submitting} onClick={removeDVD}>
              {submitting ? 'Removing…' : 'Confirm removal'}
            </button>
            <button type="button" className="remove-dvd-cancel" disabled={submitting} onClick={() => { setConfirming(false); setError('') }}>
              Cancel
            </button>
          </div>
        </> : (
          <>
            <p>The selected DVD changed. Cancel and select the DVD again.</p>
            <button type="button" className="remove-dvd-cancel" disabled={submitting} onClick={() => { setConfirming(false); setError('') }}>
              Cancel
            </button>
          </>
        )
      ) : dvd ? (
        <>
          <p>Last clicked: <strong>{dvd.title}</strong></p>
          <button type="button" className="add-dvd-submit" onClick={requestConfirmation}>Remove from shelf</button>
        </>
      ) : (
        <p className="add-dvd-hint">Click a DVD on the shelf to select it for removal.</p>
      )}
      {error && <p className="add-dvd-error" role="alert">{error}</p>}
      {success && <p className="add-dvd-success" role="status">{success}</p>}
    </div>
  )
}

export default RemoveDVDForm
