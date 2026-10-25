// Ancestor records for shraddha / barsi (F21). Not profiles: they never count toward the profile cap (M16).
import { getDb } from './connection';

export type Paksha = 'shukla' | 'krishna';

export interface AncestorInput {
  name: string;
  relation: string;
  /** Lunar month index 0 = Chaitra ... 11 = Phalguna (engine locale.lunarMonthNames order). */
  deathMonth: number;
  paksha: Paksha;
  /** 1-15 within the paksha (15 = Purnima/Amavasya). */
  tithi: number;
  year: number | null;
}

export interface Ancestor extends AncestorInput {
  id: number;
}

interface Row {
  id: number;
  name: string;
  relation: string;
  death_month: number;
  paksha: string;
  tithi: number;
  year: number | null;
}

function fromRow(r: Row): Ancestor {
  return { id: r.id, name: r.name, relation: r.relation, deathMonth: r.death_month, paksha: r.paksha as Paksha, tithi: r.tithi, year: r.year };
}

export function listAncestors(): Ancestor[] {
  return getDb().getAllSync<Row>('SELECT id, name, relation, death_month, paksha, tithi, year FROM ancestors ORDER BY id ASC').map(fromRow);
}

export function insertAncestor(a: AncestorInput): number {
  return getDb().runSync('INSERT INTO ancestors (name, relation, death_month, paksha, tithi, year) VALUES (?, ?, ?, ?, ?, ?)', [
    a.name,
    a.relation,
    a.deathMonth,
    a.paksha,
    a.tithi,
    a.year,
  ]).lastInsertRowId;
}

export function deleteAncestor(id: number): void {
  const db = getDb();
  db.runSync(`DELETE FROM scheduled WHERE series_id IN (SELECT id FROM event_series WHERE kind = 'barsi' AND ref_id = ?)`, [String(id)]);
  db.runSync(`DELETE FROM event_series WHERE kind = 'barsi' AND ref_id = ?`, [String(id)]);
  db.runSync('DELETE FROM ancestors WHERE id = ?', [id]);
}
