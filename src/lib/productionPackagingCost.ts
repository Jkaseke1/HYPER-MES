export interface CostedPackaging {
  packaging_sku_id: string;
  planned_qty: number;
  actual_qty: number;
  unit_cost: number;
}

export function resolvePackagingCosts<T extends CostedPackaging & { item_code: string }>(
  items: T[], materials: Array<{ code: string; sage_code?: string; cost_per_unit: number }>,
  posted: Array<{ sageCode: string; quantity: number; unitCost: number }> = [],
) {
  return items.map(item => {
    const code = item.item_code.trim().toUpperCase();
    const issues = posted.filter(line => line.sageCode?.trim().toUpperCase() === code
      && Number(line.quantity) === Number(item.planned_qty));
    if (issues.length === 1 && Number(issues[0].unitCost) > 0 && Number.isFinite(Number(issues[0].unitCost))) {
      return { ...item, unit_cost: Number(issues[0].unitCost) };
    }
    if (Number(item.unit_cost) > 0) return item;
    const matches = materials.filter(material => (material.sage_code || material.code)?.trim().toUpperCase() === code);
    const price = matches.length === 1 ? Number(matches[0].cost_per_unit) : 0;
    return { ...item, unit_cost: Number.isFinite(price) && price > 0 ? price : 0 };
  });
}

export function packagingCost(items: CostedPackaging[], planned = false,
  declarations?: Array<{ packaging_sku_id: string; bags_used: number }>) {
  return items.reduce((total, item) => {
    const used = declarations?.filter(line => line.packaging_sku_id === item.packaging_sku_id);
    const quantity = planned ? Number(item.planned_qty) : used?.length
      ? used.reduce((sum, line) => sum + Number(line.bags_used), 0) : Number(item.actual_qty);
    return total + quantity * Number(item.unit_cost || 0);
  }, 0);
}

export function hasUncostedPackaging(items: CostedPackaging[]) {
  return !items.length || items.some(item => !Number.isFinite(Number(item.unit_cost)) || Number(item.unit_cost) <= 0);
}
