import { app } from 'electron'
import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { CreateSessionForm } from '../../shared/session-types'

/**
 * One directory per session under userData/sessions/<id>/metadata.json.
 * Same shape as the zero CLI's session store (metadata.json + per-session dir) —
 * simple, inspectable on disk, no DB dependency for this small a dataset.
 */
export interface SessionMetadata {
  id: string
  form: CreateSessionForm
  createdAt: string
  updatedAt: string
}

function sessionsRootDir(): string {
  return join(app.getPath('userData'), 'sessions')
}

function sessionDir(id: string): string {
  return join(sessionsRootDir(), id)
}

function metadataPath(id: string): string {
  return join(sessionDir(id), 'metadata.json')
}

export function createSession(form: CreateSessionForm): SessionMetadata {
  const id = randomUUID()
  const timestamp = new Date().toISOString()
  const metadata: SessionMetadata = { id, form, createdAt: timestamp, updatedAt: timestamp }

  mkdirSync(sessionDir(id), { recursive: true })
  writeFileSync(metadataPath(id), JSON.stringify(metadata, null, 2), 'utf-8')

  return metadata
}

export function listSessions(): SessionMetadata[] {
  const root = sessionsRootDir()
  if (!existsSync(root)) {
    return []
  }

  const sessions: SessionMetadata[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const file = metadataPath(entry.name)
    if (!existsSync(file)) continue
    try {
      sessions.push(JSON.parse(readFileSync(file, 'utf-8')))
    } catch {
      // skip corrupt/partial session directories
    }
  }

  return sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getSession(id: string): SessionMetadata | null {
  const file = metadataPath(id)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf-8'))
  } catch {
    return null
  }
}
