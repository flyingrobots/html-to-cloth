import { useEffect } from 'react'
import './App.css'
import { PortfolioWebGL } from './lib/portfolioWebGL'

const projects = [
  {
    title: 'WebGL Wonderwall',
    description:
      'A gallery that wraps brand illustrations onto animated cloth banners hanging from a virtual ceiling.',
    href: '#project-wonderwall',
    tags: ['Three.js', 'Creative Coding'],
  },
  {
    title: 'Soft UI Playground',
    description:
      'Micro-interactions that respond with elastic simulations to cursor and scroll input.',
    href: '#project-soft-ui',
    tags: ['Motion', 'Experimental UX'],
  },
  {
    title: 'Threaded Storytelling',
    description:
      'Narrative case study where copy, imagery, and audio feel stitched together with real-time physics.',
    href: '#project-threaded',
    tags: ['Narrative', 'Web Audio'],
  },
]

const milestones = [
  {
    eyebrow: '2024 – Present',
    title: 'Principal Creative Technologist · Arcadia Studio',
    description:
      'Leading prototypes that blend tactile physics with brand storytelling for luxury clients.',
  },
  {
    eyebrow: '2022 – 2024',
    title: 'Senior Frontend Engineer · Playground Labs',
    description:
      'Built immersive marketing sites with performance budgets under 200kb and 60fps targets.',
  },
  {
    eyebrow: '2019 – 2022',
    title: 'Interactive Developer · Indie Interactive',
    description:
      'Shipped award-winning WebGL experiments featured on Awwwards and CSS Design Awards.',
  },
]

function App() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (prefersReducedMotion.matches) return

    const controller = new PortfolioWebGL()
    void controller.init()

    return () => controller.dispose()
  }, [])

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand cloth-enabled" aria-hidden="true">
          <span className="brand__mark">JC</span>
          <span className="brand__text">Cloth Portfolio</span>
        </div>
        <nav className="site-nav" aria-label="Primary">
          <a className="nav-link cloth-enabled" href="#projects">
            Projects
          </a>
          <a className="nav-link cloth-enabled" href="#process">
            Process
          </a>
          <a className="nav-link cloth-enabled" href="#contact">
            Contact
          </a>
        </nav>
      </header>

      <main>
        <section className="hero" id="intro">
          <div className="hero__content">
            <p className="eyebrow">Creative Web Technologist</p>
            <h1 className="hero__headline cloth-enabled">
              Tactile web experiences that feel alive in your hands.
            </h1>
            <p className="hero__body">
              I craft portfolio-worthy experiments that pair traditional layout with
              unexpected cloth physics. Hover, drag, or tap anything tagged with
              <span className="hero__tag-inline">cloth-enabled</span> to see the
              fabric peel back.
            </p>
            <div className="hero__actions">
              <a className="button button--primary cloth-enabled" href="#projects">
                See Work
              </a>
              <a className="button button--ghost cloth-enabled" href="#contact">
                Book a Prototype Session
              </a>
            </div>
          </div>
          <aside className="hero__aside">
            <div className="hero__callout cloth-enabled">
              <p className="callout__eyebrow">Next Prototype</p>
              <p className="callout__body">
                A WebGL moodboard that drapes your typography over reactive fabric.
              </p>
            </div>
          </aside>
        </section>

        <section className="section" id="projects">
          <div className="section__header">
            <p className="eyebrow">Selected Work</p>
            <h2 className="section__title">Projects staged for the cloth reveal</h2>
          </div>
          <div className="cards-grid">
            {projects.map((project) => (
              <article className="card cloth-enabled" key={project.title}>
                <div className="card__content">
                  <h3 id={project.href.replace('#', '')}>{project.title}</h3>
                  <p>{project.description}</p>
                  <ul className="pill-list" aria-label="Tags">
                    {project.tags.map((tag) => (
                      <li className="pill" key={tag}>
                        {tag}
                      </li>
                    ))}
                  </ul>
                </div>
                <a className="card__link" href={project.href}>
                  View case study
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="process">
          <div className="section__header">
            <p className="eyebrow">Process</p>
            <h2 className="section__title">How the cloth illusion comes together</h2>
          </div>
          <div className="timeline">
            {milestones.map((item) => (
              <div className="timeline__item cloth-enabled" key={item.title}>
                <p className="timeline__eyebrow">{item.eyebrow}</p>
                <h3 className="timeline__title">{item.title}</h3>
                <p className="timeline__body">{item.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer" id="contact">
        <div className="footer__content cloth-enabled">
          <h2>Let&apos;s stitch something together</h2>
          <p>
            I&apos;m currently open for collaborations and prototyping engagements.
            Drop a note at
            <a className="footer__link" href="mailto:james@cloth.dev">
              james@cloth.dev
            </a>
            or find me on{' '}
            <a className="footer__link" href="https://twitter.com" target="_blank" rel="noreferrer">
              Twitter
            </a>{' '}
            and{' '}
            <a className="footer__link" href="https://www.linkedin.com" target="_blank" rel="noreferrer">
              LinkedIn
            </a>
            .
          </p>
        </div>
        <p className="footer__note">© {new Date().getFullYear()} James Cloth. Built for experiments.</p>
      </footer>
    </div>
  )
}

export default App
