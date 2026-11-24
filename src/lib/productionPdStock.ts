// Display/preflight only. The issue RPC and Sage adapter must independently
// validate available PD stock and reserve it; this cache is not a stock lock.
export function freshPdQuantity(quantity: unknown, syncedAt: string | null | undefined,
  maxAgeMinutes: number, now = Date.now()): number | null {
  if (quantity === null || quantity === undefined || quantity === '' || !syncedAt) return null;
  const value = Number(quantity);
  const timestamp = Date.parse(syncedAt);
  const age = now - timestamp;
  if (!Number.isFinite(value) || value < 0 || !Number.isFinite(timestamp)
      || age < 0 || age > maxAgeMinutes * 60_000) return null;
  return value;
}

export interface PdRequirement {
  raw_material_id: string;
  planned_qty: number;
  issued: boolean;
  unit?: string;
  raw_materials?: { name?: string };
}

export function pdStockProblems(materials: PdRequirement[], quantities: Record<string, number>,
  timestamps: Record<string, string | null>, maxAgeMinutes: number, now = Date.now()): string[] {
  const totals = new Map<string, { name: string; quantity: number; unit: string }>();
  const problems: string[] = [];
  for (const material of materials.filter(m => !m.issued)) {
    const id = material.raw_material_id;
    const name = material.raw_materials?.name || id;
    const quantity = Number(material.planned_qty);
    if (!id || !Number.isFinite(quantity) || quantity <= 0) {
      problems.push(`${name || 'Ingredient'}: invalid planned quantity or material mapping`);
      continue;
    }
    const unit = material.unit || 'kg';
    const prior = totals.get(id);
    if (prior && prior.unit !== unit) {
      problems.push(`${name}: conflicting units; reconcile the BOM`);
      continue;
    }
    totals.set(id, { name, quantity: quantity + (prior?.quantity || 0), unit });
  }
  for (const [id, requirement] of totals) {
    const available = freshPdQuantity(quantities[id], timestamps[id], maxAgeMinutes, now);
    if (available === null) problems.push(`${requirement.name}: fresh Sage PD stock is unavailable; refresh stock`);
    else if (available < requirement.quantity) problems.push(
      `${requirement.name}: requires ${requirement.quantity} ${requirement.unit}, PD has ${available} ${requirement.unit}`);
  }
  return problems;
}
