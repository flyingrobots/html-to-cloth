import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../App'

function modKey() {
  const isMac = (globalThis.navigator?.platform || '').toLowerCase().includes('mac')
  return isMac ? 'Meta' : 'Control'
}

describe('Events panel (spec)', () => {
  it('toggles with Cmd/Ctrl+E and is non-modal (scene remains interactive)', async () => {
    render(<App />)
    const user = userEvent.setup()

    // Toggle open with modifier + E
    await user.keyboard(`{${modKey()}>}e{/${modKey()}}`)
    // Title should be visible
    expect(await screen.findByText('Events')).toBeTruthy()

    // Non-modal: the primary scene button remains clickable
    const btn = await screen.findByRole('button', { name: /peel back/i })
    await user.click(btn)
    // Toggle closed with modifier + E
    await user.keyboard(`{${modKey()}>}e{/${modKey()}}`)
    expect(screen.queryByText('Events')).toBeNull()
  })
})
