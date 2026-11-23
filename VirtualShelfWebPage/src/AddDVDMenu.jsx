import { useRef, useState } from 'react'
import ExistingDVDForm from './ExistingDVDForm.jsx'
import RemoveDVDForm from './RemoveDVDForm.jsx'
import './AddDVDMenu.css'

/**
 * 
 */

const imageTypes = '.png,.jpg,.jpeg,.webp,.gif'

function parseNames(value) {
  return value.split('\n').map((name) => name.trim()).filter(Boolean)
}

function AddDVDMenu({ baseURL, userName, onAdded, onRemoved, onOperationError, selectedDVD, open, setOpen }) {
  const [submitting, setSubmitting] = useState(false)
  const [action, setAction] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const submittingRef = useRef(false)
  const toggleRef = useRef(null)

  function closeMenu() {
    setOpen(false)
    toggleRef.current?.focus()
  }

  async function submitDVD(event) {
    event.preventDefault()
    //if the dvd is already being submitted, prevent duplicate submissions
    if (submittingRef.current) return

    //formData is used to read the form inputs
    const form = event.currentTarget
    const data = new FormData(form)
    //check if the title is provided
    const title = data.get('title').trim()
    if (!title) {
      setError('Enter a title.')
      return
    }

    //turn all of the form inputs into json for api request
    data.set('username', userName)
    data.set('title', title)
    data.set('actors', JSON.stringify(parseNames(data.get('actors'))))
    data.set('directors', JSON.stringify(parseNames(data.get('directors'))))
    setError('')
    setSuccess('')
    submittingRef.current = true
    setSubmitting(true)

    //actually send post to API
    try {
      const response = await fetch(`${baseURL}/api/dvds/addDVD`, {
        method: 'POST',
        body: data,
      })
      //
      if (!response.ok) {
        //get api error response
        const body = await response.json().catch(() => null)
        //if the type of the detail body is just a status (aka int) display that, otherwise show the detail message
        const detail = typeof body?.detail === 'string' ? body.detail : `Request failed (${response.status}).`
        throw new Error(detail)
      }

      
      const dvd = await response.json()
      onAdded(dvd)
      form.reset()
      setSuccess(`Added "${dvd.title}" to your shelf.`)
    } catch (requestError) {
      console.error('Failed to add DVD:', requestError)
      setError(requestError.message || 'Failed to add DVD. Please try again.')
      onOperationError(requestError.message || 'Failed to add DVD.')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="add-dvd-menu">
      <button
        ref={toggleRef}
        type="button"
        className="add-dvd-toggle"
        aria-label={open ? 'Close add DVD menu' : 'Open add DVD menu'}
        aria-expanded={open}
        aria-controls="add-dvd-panel"
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true">{open ? '×' : '+'}</span>
      </button>
        <section
          id="add-dvd-panel"
          className="add-dvd-panel"
          aria-labelledby="add-dvd-heading"
          hidden={!open}
          onKeyDown={(event) => {
            if (event.key === 'Escape') closeMenu()
          }}
        >
          <div className="add-dvd-heading">
            <div>
              <h2 id="add-dvd-heading">Manage DVDs</h2>
              <p>Managing {userName}&apos;s shelf</p>
            </div>
            <button type="button" className="add-dvd-close" onClick={closeMenu} aria-label="Close add DVD menu">×</button>
          </div>
          <label htmlFor="dvd-action">Choose an action</label>
          <select id="dvd-action" value={action} onChange={(event) => setAction(event.target.value)}>
            <option value="">Select an action</option>
            <option value="existing">Add an existing DVD</option>
            <option value="new">Create a new DVD</option>
            <option value="remove">Remove a DVD from my shelf</option>
          </select>
          <div hidden={action !== 'existing'}>
            <ExistingDVDForm baseURL={baseURL} userName={userName} onAdded={onAdded} onOperationError={onOperationError} active={open && action === 'existing'} />
          </div>
          {action === 'remove' && (
            <RemoveDVDForm baseURL={baseURL} userName={userName} dvd={selectedDVD} onRemoved={onRemoved} onOperationError={onOperationError} />
          )}
          <form onSubmit={submitDVD} hidden={action !== 'new'}>
            <label htmlFor="dvd-title">Title</label>
            <input id="dvd-title" name="title" type="text" required />

            <label htmlFor="dvd-actors">Actors <span>(one per line)</span></label>
            <textarea id="dvd-actors" name="actors" rows="2" />

            <label htmlFor="dvd-directors">Directors <span>(one per line)</span></label>
            <textarea id="dvd-directors" name="directors" rows="2" />

            <label htmlFor="dvd-description">Description</label>
            <textarea id="dvd-description" name="description" rows="3" />

            <p className="add-dvd-hint">Upload PNG, JPEG, WebP or GIF images for each side.</p>
            <label htmlFor="dvd-front">Front cover</label>
            <input id="dvd-front" name="front_face" type="file" accept={imageTypes} required />
            <label htmlFor="dvd-back">Back cover</label>
            <input id="dvd-back" name="back_face" type="file" accept={imageTypes} required />
            <label htmlFor="dvd-spine">Spine</label>
            <input id="dvd-spine" name="spine" type="file" accept={imageTypes} required />

            {error && <p className="add-dvd-error" role="alert">{error}</p>}
            {success && <p className="add-dvd-success" role="status">{success}</p>}
            <button className="add-dvd-submit" type="submit" disabled={submitting}>
              {submitting ? 'Adding DVD…' : 'Add to shelf'}
            </button>
          </form>
        </section>
    </div>
  )
}

export default AddDVDMenu
