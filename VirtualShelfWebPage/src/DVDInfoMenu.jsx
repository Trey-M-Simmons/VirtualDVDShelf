import { useRef } from 'react'
import './AddDVDMenu.css'
import './DVDInfoMenu.css'

function DVDInfoMenu({ dvd, open, setOpen }) {
  const toggleRef = useRef(null)

  function closeMenu() {
    setOpen(false)
    toggleRef.current?.focus()
  }

  return (
    <div className="add-dvd-menu dvd-info-menu">
      <button
        ref={toggleRef}
        type="button"
        className="add-dvd-toggle dvd-info-toggle"
        aria-label={open ? 'Close DVD information' : 'Open DVD information'}
        aria-expanded={open}
        aria-controls="dvd-info-panel"
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true">i</span>
      </button>
      {open && (
        <section
          id="dvd-info-panel"
          className="add-dvd-panel dvd-info-panel"
          aria-labelledby="dvd-info-heading"
          onKeyDown={(event) => {
            if (event.key === 'Escape') closeMenu()
          }}
        >
          <div className="add-dvd-heading">
            <h2 id="dvd-info-heading">DVD information</h2>
            <button type="button" className="add-dvd-close" onClick={closeMenu} aria-label="Close DVD information">×</button>
          </div>
          {dvd ? (
            <dl className="dvd-info-details">
              <dt>Title</dt>
              <dd>{dvd.title}</dd>
              <dt>Actors</dt>
              <dd>{dvd.actors.length ? dvd.actors.join(', ') : 'Not specified'}</dd>
              <dt>Directors</dt>
              <dd>{dvd.directors.length ? dvd.directors.join(', ') : 'Not specified'}</dd>
              <dt>Description</dt>
              <dd className="dvd-info-description">{dvd.desc || 'Not specified'}</dd>
            </dl>
          ) : (
            <p className="add-dvd-hint">Click a DVD on the shelf to see its details.</p>
          )}
        </section>
      )}
    </div>
  )
}

export default DVDInfoMenu
