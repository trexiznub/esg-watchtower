import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* GitHub Pages serves a project site from https://<user>.github.io/<repo>/, so every asset URL
   needs the "/<repo>/" prefix. In GitHub Actions the repository name is read from
   GITHUB_REPOSITORY, so no edit is needed when the repo is renamed or forked.
   A user/organisation site (<user>.github.io) is served from the root and gets "/".
   Set VITE_BASE to override, for example VITE_BASE=/ for a custom domain. */
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base = process.env.VITE_BASE ?? (repo && !repo.endsWith('.github.io') ? `/${repo}/` : '/');

export default defineConfig({
  base,
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false }
});
