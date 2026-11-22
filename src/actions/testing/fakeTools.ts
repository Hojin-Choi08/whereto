/**
 * In-memory ActionTools for action handler tests. Mirrors the parts of the
 * real tools contract the actions use: equality `where`, upsert-on-recordId
 * create (merge), update/remove/deleteWhere, and ActionResult envelopes.
 */

import type { ActionResult, ActionTools } from 'deepspace/worker'

export type Row = { recordId: string; data: Record<string, unknown> }

export function fakeTools(opts: { failCreate?: (coll: string) => boolean } = {}) {
  const db = new Map<string, Map<string, Row>>()
  const coll = (c: string) => db.get(c) ?? db.set(c, new Map()).get(c)!
  const ok = <T,>(data: T): ActionResult<T> => ({ success: true, data })
  const matches = (row: Row, where: Record<string, unknown> = {}) =>
    Object.entries(where).every(([k, v]) => (k === 'recordId' ? row.recordId : row.data[k]) === v)
  /** Every status written to `rooms`, in order. */
  const statusLog: unknown[] = []

  const tools = {
    async get(c: string, id: string) {
      const row = coll(c).get(id)
      return row ? ok({ record: row }) : { success: false, error: 'Record not found' }
    },
    async query(c: string, o: { where?: Record<string, unknown> } = {}) {
      const records = [...coll(c).values()].filter((r) => matches(r, o.where))
      return ok({ records, count: records.length })
    },
    async create(c: string, data: Record<string, unknown>, recordId = crypto.randomUUID()) {
      if (opts.failCreate?.(c)) return { success: false, error: `boom creating ${c}` }
      const prev = coll(c).get(recordId)
      coll(c).set(recordId, { recordId, data: { ...prev?.data, ...data } })
      return ok({ recordId })
    },
    async update(c: string, id: string, data: Record<string, unknown>) {
      const row = coll(c).get(id)
      if (!row) return { success: false, error: 'Record not found' }
      if (c === 'rooms' && 'status' in data) statusLog.push(data.status)
      row.data = { ...row.data, ...data }
      return ok({ recordId: id })
    },
    async remove(c: string, id: string) {
      coll(c).delete(id)
      return ok({ recordId: id })
    },
    async deleteWhere(c: string, where: Record<string, unknown>) {
      let deleted = 0
      for (const [id, row] of coll(c)) {
        if (matches(row, where)) {
          coll(c).delete(id)
          deleted++
        }
      }
      return ok({ deleted })
    },
    integration: async () => ({ success: false, error: 'unused' }),
    registerUser: async () => ({ success: false, error: 'unused' }),
  } as unknown as ActionTools

  return { tools, db, coll, statusLog }
}

export type FakeTools = ReturnType<typeof fakeTools>
