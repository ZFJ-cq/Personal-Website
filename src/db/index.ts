import type { DbAdapter } from './types'
import { TursoAdapter } from './turso'
import { LocalAdapter } from './sqljs'

export {
  ensureDb,
  db,
  dbMode,
  dbReady,
  dbError,
  connectTurso,
  disconnectTurso,
  readTursoConfig,
  exportDatabase,
  importDatabase,
} from './adapter'
export { TursoAdapter, LocalAdapter }
export type { DbAdapter }
