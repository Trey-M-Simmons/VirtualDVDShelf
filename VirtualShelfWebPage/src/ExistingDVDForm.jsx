import { useEffect, useRef, useState } from 'react'

function ExistingDVDForm({ baseURL, userName, onAdded, onOperationError, active }) {
  const [catalog, setCatalog] = useState([])
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [textureId, setTextureId] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [reload, setReload] = useState(0)
  const submittingRef = useRef(false)

  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    async function loadCatalog() {
      setLoading(true)
      setLoadError('')
      try {
        const response = await fetch(`${baseURL}/api/dvds/`, { signal: controller.signal })
        if (!response.ok) throw new Error(`Could not load DVDs (${response.status}).`)
        const data = await response.json()
        if (!controller.signal.aborted) setCatalog(data)
      } catch (requestError) {
        if (!controller.signal.aborted) {
          console.error('Failed to load DVD catalog:', requestError)
          setLoadError(requestError.message || 'Could not load DVDs.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    loadCatalog()
    return () => controller.abort()
  }, [active, baseURL, reload])

  const results = query.trim()
    ? catalog.filter(dvd => dvd.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    : []
  const selected = catalog.find(dvd => dvd.dvd_id === selectedId)

  async function submit(event) {
    event.preventDefault()
    if (submittingRef.current || loading || loadError || !selected || !selected.texture_set_ids.includes(textureId)) return
    submittingRef.current = true
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch(`${baseURL}/api/dvds/addExistingDVD`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: userName, dvd_id: selectedId, texture_set_id: textureId }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(typeof body?.detail === 'string' ? body.detail : `Request failed (${response.status}).`)
      }
      const dvd = await response.json()
      onAdded(dvd)
      setSuccess(`Added "${dvd.title}" to your shelf.`)
      setSelectedId('')
      setTextureId('')
      setQuery('')
    } catch (requestError) {
      console.error('Failed to add existing DVD:', requestError)
      setError(requestError.message || 'Failed to add DVD. Please try again.')
      onOperationError(requestError.message || 'Failed to add DVD.')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="dvd-search">Find a DVD by title</label>
      <input id="dvd-search" type="search" value={query} onChange={(event) => {
        setQuery(event.target.value)
        setSelectedId('')
        setTextureId('')
        setSuccess('')
      }} />
      {loading && <p className="add-dvd-hint" role="status">Loading DVDs…</p>}
      {!loading && !loadError && query.trim() && !results.length && <p className="add-dvd-hint">No matching DVDs found.</p>}
      {!loading && !loadError && results.length > 0 && (
        <fieldset className="dvd-choice-list">
          <legend>Choose a DVD</legend>
          {results.map(dvd => (
            <label key={dvd.dvd_id}>
              <input type="radio" name="catalog-dvd" value={dvd.dvd_id} checked={selectedId === dvd.dvd_id}
                onChange={() => { setSelectedId(dvd.dvd_id); setTextureId(''); setError(''); setSuccess('') }} />
              <span><strong>{dvd.title}</strong><br />{dvd.actors.join(', ') || 'No actors listed'} · {dvd.directors.join(', ') || 'No directors listed'}</span>
            </label>
          ))}
        </fieldset>
      )}
      {!loading && !loadError && selected && (
        <>
          <p className="add-dvd-hint">Description: {selected.description || 'Not specified'}</p>
          {selected.texture_set_ids.length ? (
          <fieldset className="dvd-choice-list">
            <legend>Choose a texture set</legend>
            {selected.texture_set_ids.map((id, index) => (
              <label key={id} className="texture-choice">
                <input type="radio" name="texture-set" value={id} checked={textureId === id}
                  onChange={() => setTextureId(id)} required />
                <span>Texture set {index + 1}
                  <span className="texture-previews">
                    {['front_face', 'back_face', 'spine'].map(face => (
                      <span key={face}>
                        <img src={`${baseURL}/api/textures/${id}/${face}`} alt={`${face.replace('_', ' ')} preview`}
                          onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.nextSibling.hidden = false }} />
                        <span className="texture-preview-error" hidden>Preview unavailable</span>
                        <small>{face.replace('_', ' ')}</small>
                      </span>
                    ))}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          ) : <p className="add-dvd-hint">This DVD has no texture sets available.</p>}
        </>
      )}
      {loadError && <p className="add-dvd-error" role="alert">{loadError}</p>}
      {loadError && <button type="button" onClick={() => setReload(value => value + 1)}>Retry loading DVDs</button>}
      {error && <p className="add-dvd-error" role="alert">{error}</p>}
      {success && <p className="add-dvd-success" role="status">{success}</p>}
      <button className="add-dvd-submit" type="submit" disabled={loading || !!loadError || !selected || !selected.texture_set_ids.includes(textureId) || submitting}>
        {submitting ? 'Adding DVD…' : 'Add to shelf'}
      </button>
    </form>
  )
}

export default ExistingDVDForm
