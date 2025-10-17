# Mantine Migration & TypeScript Exit Checklist

We will tackle the UI/tooling refactor in discrete steps. Each item gets its own commit.

- [x] Drop shadcn/Tailwind: remove related dependencies, configs, and generated components.
- [x] Install Mantine packages and wire a `MantineProvider` wrapper around the app.
- [x] Rebuild the debug palette and key UI widgets with Mantine components.
- [x] Clean up styling (replace Tailwind utilities with CSS or Mantine styles, update `index.css`).
- [x] Fix tests and mocks impacted by the UI swap (Vitest/domIntegration).
- [ ] Update BLOG_NOTES.md with the migration context.
- [x] Verify `npm run build` and `npm test` succeed after the Mantine swap.
- [ ] Begin TypeScript removal: relax configs, start converting modules to plain JS with AI-generated JSDoc.
- [ ] Finish TypeScript purge (no `*.ts` remains, tsconfig removed) and validate the build.
