import { execSync } from 'child_process';

/**
 * Короткий хеш коммита, из которого запущен бэкенд (как в `git log --oneline`).
 * Считается один раз при старте процесса. GIT_COMMIT / COMMIT_SHA перекрывают git,
 * если в проде нет каталога .git.
 */
function readBuildCommit(): string {
  const fromEnv = (process.env.GIT_COMMIT || process.env.COMMIT_SHA || '').trim();
  if (/^[0-9a-f]{7,40}$/i.test(fromEnv)) {
    return fromEnv.slice(0, 7).toLowerCase();
  }
  try {
    const hash = execSync('git rev-parse --short=7 HEAD', {
      encoding: 'utf8',
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    }).trim();
    if (/^[0-9a-f]{7,}$/i.test(hash)) {
      return hash.slice(0, 7).toLowerCase();
    }
  } catch {
    // Репозитория рядом нет — версия просто не показывается.
  }
  return '';
}

export const buildCommit = readBuildCommit();
