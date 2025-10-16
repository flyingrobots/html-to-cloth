# Mantine Migration & TypeScript Exit Checklist

We will tackle the UI/tooling refactor in discrete steps. Each item gets its own commit.

- [ ] Drop shadcn/Tailwind: remove related dependencies, configs, and generated components.
- [ ] Install Mantine packages and wire a `MantineProvider` wrapper around the app.
- [ ] Rebuild the debug palette and key UI widgets with Mantine components.
- [ ] Clean up styling (replace Tailwind utilities with CSS or Mantine styles, update `index.css`).
- [ ] Fix tests and mocks impacted by the UI swap (Vitest/domIntegration).
- [ ] Update BLOG_NOTES.md with the migration context.
- [ ] Verify `npm run build` and `npm test` succeed after the Mantine swap.
- [ ] Begin TypeScript removal: relax configs, start converting modules to plain JS with AI-generated JSDoc.
- [ ] Finish TypeScript purge (no `*.ts` remains, tsconfig removed) and validate the build.
