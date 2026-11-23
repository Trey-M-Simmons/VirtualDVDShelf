import { useEffect, useRef, useState } from 'react'
import './AddDVDMenu.css'
import './AccountMenu.css'

function AccountMenu({ baseURL, userName, onSelect, open, setOpen }) {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [creating, setCreating] = useState(false)
  const [reload, setReload] = useState(0)
  const creatingRef = useRef(false)
  const toggleRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    async function loadAccounts() {
      setLoading(true)
      setLoadError('')
      try {
        const response = await fetch(`${baseURL}/api/accounts/`, { signal: controller.signal })
        if (!response.ok) throw new Error(`Could not load accounts (${response.status}).`)
        const data = await response.json()
        if (!controller.signal.aborted) setAccounts(data)
      } catch (requestError) {
        if (!controller.signal.aborted) {
          console.error('Failed to load accounts:', requestError)
          setLoadError(requestError.message || 'Could not load accounts.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    loadAccounts()
    return () => controller.abort()
  }, [open, baseURL, reload])

  function closeMenu() {
    setOpen(false)
    toggleRef.current?.focus()
  }

  async function createAccount(event) {
    event.preventDefault()
    if (creatingRef.current) return
    const username = newUsername.trim()
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(username)) {
      setError('Use 1-64 letters, numbers, underscores, or hyphens.')
      return
    }
    creatingRef.current = true
    setCreating(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch(`${baseURL}/api/accounts/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(typeof body?.detail === 'string' ? body.detail : `Request failed (${response.status}).`)
      }
      const account = await response.json()
      setAccounts(previous => [...previous.filter(item => item.username !== account.username), account])
      if (loadError) setReload(value => value + 1)
      onSelect(account.username)
      setNewUsername('')
      setSuccess(`Created and selected "${account.username}".`)
    } catch (requestError) {
      console.error('Failed to create account:', requestError)
      setError(requestError.message || 'Could not create account.')
    } finally {
      creatingRef.current = false
      setCreating(false)
    }
  }

  return (
    <div className="add-dvd-menu account-menu">
      <button ref={toggleRef} type="button" className="add-dvd-toggle account-toggle"
        aria-label={open ? 'Close account menu' : 'Open account menu'} aria-expanded={open}
        aria-controls="account-panel" onClick={() => setOpen(!open)}>
        <span aria-hidden="true">👤</span>
      </button>
      {open && (
        <section id="account-panel" className="add-dvd-panel account-panel" aria-labelledby="account-heading"
          onKeyDown={(event) => { if (event.key === 'Escape') closeMenu() }}>
          <div className="add-dvd-heading">
            <div>
              <h2 id="account-heading">Accounts</h2>
              <p>Current account: {userName}</p>
            </div>
            <button type="button" className="add-dvd-close" onClick={closeMenu} aria-label="Close account menu">×</button>
          </div>
          <p className="add-dvd-hint">Accounts are not password-protected. Anyone with access can select any account. This page was created to debug for future real account functionality.</p>
          <label htmlFor="account-select">Choose an account</label>
          <select id="account-select" value={accounts.some(account => account.username === userName) ? userName : ''}
            disabled={loading || creating || !!loadError}
            onChange={(event) => { if (event.target.value) { onSelect(event.target.value); setSuccess(''); setError('') } }}>
            <option value="" disabled>{loading ? 'Loading accounts...' : 'Select an account'}</option>
            {accounts.map(account => <option key={account.username} value={account.username}>{account.username}</option>)}
          </select>
          {loadError && <p className="add-dvd-error" role="alert">{loadError}</p>}
          {loadError && <button type="button" onClick={() => setReload(value => value + 1)}>Retry loading accounts</button>}
          {!loading && !loadError && accounts.length === 0 && <p className="add-dvd-hint">No accounts yet. Create one below.</p>}
          <form onSubmit={createAccount}>
            <label htmlFor="new-account-name">Create a new account</label>
            <input id="new-account-name" value={newUsername} onChange={(event) => setNewUsername(event.target.value)}
              placeholder="Username" maxLength={64} required />
            <p className="add-dvd-hint">Use letters, numbers, underscores, or hyphens. Names are case-sensitive.</p>
            {error && <p className="add-dvd-error" role="alert">{error}</p>}
            {success && <p className="add-dvd-success" role="status">{success}</p>}
            <button type="submit" className="add-dvd-submit" disabled={creating || loading}>
              {creating ? 'Creating account...' : 'Create and select account'}
            </button>
          </form>
        </section>
      )}
    </div>
  )
}

export default AccountMenu
