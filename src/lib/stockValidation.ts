import { supabase } from './supabase';

export interface StockCheckResult {
  isValid: boolean;
  errors: StockError[];
}

export interface StockError {
  materialId: string;
  materialName: string;
  available: number;
  requested: number;
  shortfall: number;
}

/**
 * Check if materials have sufficient stock before issuing
 * @param materials Array of {raw_material_id, quantity} to check
 * @returns StockCheckResult with validation status and any errors
 */
export async function validateStockAvailability(
  materials: Array<{ raw_material_id: string; quantity: number; name?: string }>
): Promise<StockCheckResult> {
  if (!materials || materials.length === 0) {
    return { isValid: true, errors: [] };
  }

  try {
    // Fetch current stock for all materials
    const materialIds = materials.map((m) => m.raw_material_id);
    const { data: stockData, error: stockError } = await supabase
      .from('raw_materials')
      .select('id, name, current_stock')
      .in('id', materialIds);

    if (stockError) throw stockError;

    const errors: StockError[] = [];

    // Check each material
    for (const material of materials) {
      const stock = stockData?.find((s: any) => s.id === material.raw_material_id);
      const available = stock?.current_stock || 0;
      const requested = material.quantity;

      if (available < requested) {
        errors.push({
          materialId: material.raw_material_id,
          materialName: stock?.name || material.name || 'Unknown Material',
          available,
          requested,
          shortfall: requested - available,
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  } catch (error) {
    console.error('Stock validation error:', error);
    return {
      isValid: false,
      errors: [
        {
          materialId: '',
          materialName: 'System Error',
          available: 0,
          requested: 0,
          shortfall: 0,
        },
      ],
    };
  }
}

/**
 * Log a stock exception when override is needed
 */
export async function logStockException(
  transactionType: string,
  materialName: string,
  availableQty: number,
  requestedQty: number,
  overrideReason: string
): Promise<boolean> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user?.id) return false;

    const { error } = await supabase.from('stock_exceptions').insert({
      transaction_type: transactionType,
      material_name: materialName,
      available_qty: availableQty,
      requested_qty: requestedQty,
      shortfall_qty: requestedQty - availableQty,
      override_reason: overrideReason,
      overridden_by: user.user.id,
    });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Failed to log stock exception:', error);
    return false;
  }
}

/**
 * Format stock error message for display
 */
export function formatStockErrorMessage(errors: StockError[]): string {
  if (errors.length === 0) return '';

  const lines = errors.map(
    (e) =>
      `${e.materialName}: ${e.available.toFixed(2)}kg available, ${e.requested.toFixed(2)}kg required (short by ${e.shortfall.toFixed(2)}kg)`
  );

  return `Insufficient stock:\n${lines.join('\n')}`;
}
