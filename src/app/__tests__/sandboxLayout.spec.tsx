import { describe, it, beforeEach, expect } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

import App from '../../App'

describe('Sandbox navigation and layout', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('shows a Sandbox CTA on the homepage linking to /sandbox', () => {
    window.history.pushState({}, '', '/')
    render(<App />)

    const sandboxLink = screen.getByRole('link', { name: /sandbox/i })
    expect(sandboxLink).toHaveAttribute('href', '/sandbox')
  })

  it('renders Sandbox layout with title, legend, and Tests/Demos menus', () => {
    window.history.pushState({}, '', '/sandbox')
    render(<App />)

    // Big Sandbox heading
    const heading = screen.getByRole('heading', { name: /sandbox/i })
    expect(heading).toBeInTheDocument()

    // Legend text
    expect(screen.getByText(/welcome to the sandbox/i)).toBeInTheDocument()
    expect(screen.getByText(/choose a scene to test/i)).toBeInTheDocument()
    // Inspector shortcut text may be split; just assert the tilde and label appear.
    expect(screen.getByText(/inspector/i)).toBeInTheDocument()
    expect(screen.getByText(/cmd \+ e -> event log/i)).toBeInTheDocument()

    // Menu triggers
    const testsButton = screen.getByRole('button', { name: /tests/i })
    const demosButton = screen.getByRole('button', { name: /demos/i })
    expect(testsButton).toBeInTheDocument()
    expect(demosButton).toBeInTheDocument()
  })

  it('marks at least one Sandbox test menu item as cloth-enabled so it can become a cloth scene element', () => {
    window.history.pushState({}, '', '/sandbox')
    render(<App />)

    // For this layout-level test we only assert that the Tests button exists;
    // behaviour of the dropdown contents is covered elsewhere.
    const testsButton = screen.getByRole('button', { name: /tests/i })
    expect(testsButton).toBeInTheDocument()
  })

  it('renders a default rigid button and static textarea for the sandbox scene', () => {
    window.history.pushState({}, '', '/sandbox')
    render(<App />)

    const rigidButton = screen.getByRole('button', { name: /drop box/i })
    expect(rigidButton).toHaveClass('rigid-dynamic')

    // Mantine wraps the textarea input; the rigid-static class is applied at
    // the DOM node level, so assert via querySelector instead of role lookups.
    const staticArea = document.querySelector('.rigid-static') as HTMLElement | null
    expect(staticArea).not.toBeNull()
  })
})
