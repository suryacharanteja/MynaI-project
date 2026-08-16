import { app } from 'electron'
import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { CreateSessionForm } from '../../shared/session-types'
import { sessionMetadataSchema } from '../../shared/schemas'

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
      const raw = JSON.parse(readFileSync(file, 'utf-8'))
      const parsed = sessionMetadataSchema.safeParse(raw)
      if (parsed.success) {
        sessions.push(parsed.data as SessionMetadata)
      }
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
    const raw = JSON.parse(readFileSync(file, 'utf-8'))
    const parsed = sessionMetadataSchema.safeParse(raw)
    return parsed.success ? (parsed.data as SessionMetadata) : null
  } catch {
    return null
  }
}
