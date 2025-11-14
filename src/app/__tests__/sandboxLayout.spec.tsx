import { describe, it, beforeEach, expect } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'

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
    expect(screen.getByText(/cmd \+ j -> inspector/i)).toBeInTheDocument()
    expect(screen.getByText(/cmd \+ e -> event log/i)).toBeInTheDocument()

    // Menu triggers
    const testsButton = screen.getByRole('button', { name: /tests/i })
    const demosButton = screen.getByRole('button', { name: /demos/i })
    expect(testsButton).toBeInTheDocument()
    expect(demosButton).toBeInTheDocument()
  })
})

