# Multi-Currency Support Guide
## Managing Multiple Currencies in HYPER MES

This guide explains how to use the multi-currency features in your manufacturing system.

---

## Supported Currencies

| Currency | Code | Symbol | Usage |
|----------|------|--------|-------|
| **US Dollar** | USD | $ | Base currency (default) |
| **South African Rand** | ZAR | R | Regional suppliers |
| **Zimbabwe Gold** | ZWG | ZWG | Local transactions |
| **British Pound** | GBP | £ | International suppliers |

---

## How Multi-Currency Works

### Base Currency: USD
- All financial reports are in USD
- System automatically converts other currencies to USD
- Exchange rates are maintained in the system

### Transaction Currency
- Record costs in the supplier's currency
- System stores both local currency and USD equivalent
- Historical rates preserved for accurate reporting

---

## Exchange Rate Management

### Viewing Current Rates

Navigate to: **Finance → Exchange Rates**

Current rates (as of today):

| From | To | Rate | Example |
|------|-----|------|---------|
| USD | ZAR | 18.50 | $1 = R18.50 |
| USD | ZWG | 13.50 | $1 = ZWG 13.50 |
| USD | GBP | 0.79 | $1 = £0.79 |
| ZAR | USD | 0.054 | R1 = $0.054 |
| ZWG | USD | 0.074 | ZWG 1 = $0.074 |
| GBP | USD | 1.27 | £1 = $1.27 |

### Updating Exchange Rates

**When to Update:**
- Daily (for volatile currencies like ZWG)
- Weekly (for stable currencies)
- Before major purchases
- When rates change significantly

**How to Update:**
1. Go to **Finance → Exchange Rates**
2. Click **Add Exchange Rate**
3. Select currencies (From/To)
4. Enter new rate
5. Set effective date
6. Save

**Important:** System uses the most recent rate on or before the transaction date.

---

## Using Multi-Currency in Transactions

### 1. Supplier Setup

When creating a supplier, set their default currency:

```
Supplier: ABC Grains (South Africa)
- Default Currency: ZAR (Rand)
- Payment Terms: 30 days
```

This ensures all GRNs from this supplier default to ZAR.

### 2. Raw Material Costs

When adding raw materials, specify the currency:

```
Material: Maize Meal
- Cost per Unit: R 9.25 (ZAR)
- Currency: ZAR
- System Auto-Calculates: $0.50 USD
```

**How it works:**
- You enter: R 9.25 in ZAR
- System converts: R 9.25 × 0.054 = $0.50 USD
- Both values stored for reporting

### 3. Goods Received Notes (GRN)

When receiving materials:

```
GRN-2026-001
Supplier: ABC Grains (ZAR)
Item: Maize Meal
- Quantity: 5000 kg
- Unit Cost: R 9.25 (ZAR)
- Line Total: R 46,250 (ZAR)
- USD Equivalent: $2,500 (auto-calculated)
```

**Benefits:**
- Invoice matches supplier currency
- Payment in correct currency
- Financial reports in USD
- Exchange rate locked at GRN date

### 4. Production Costing

Production orders track costs in USD:

```
Production Order: BATCH-2026-001
Raw Material Costs:
- Maize Meal: 500 kg × $0.50 = $250 USD
- Soya Meal: 350 kg × $0.80 = $280 USD
- Total Raw Materials: $530 USD

Labour Cost: $50 USD
Machine Cost: $20 USD
Total Cost: $600 USD
Cost per kg: $0.60 USD
```

All production costs standardized in USD for comparison.

### 5. Dispatch & Sales

When dispatching to branches, you can price in any currency:

```
Dispatch to Bulawayo Branch
Product: Broiler Starter Feed
- Quantity: 500 kg
- Unit Price: R 13.00 (ZAR)
- Line Total: R 6,500 (ZAR)
- USD Equivalent: $351 (auto-calculated)
```

---

## Practical Examples

### Example 1: South African Supplier

**Scenario:** Purchasing soya from South Africa

```
1. Create Supplier:
   Name: SA Soya Suppliers
   Currency: ZAR
   
2. Create GRN:
   Material: Soya Bean Meal
   Quantity: 2000 kg
   Unit Cost: R 14.80 (ZAR)
   Total: R 29,600 (ZAR)
   
3. System Records:
   - Local Currency: R 29,600
   - USD: $1,598.40 (using rate 0.054)
   - Exchange Rate Date: GRN date
   
4. Payment:
   - Pay supplier R 29,600 in Rand
   - Books show $1,598.40 expense
```

### Example 2: UK Supplier (Vitamins)

**Scenario:** Importing vitamin premix from UK

```
1. Create Supplier:
   Name: UK Vitamins Ltd
   Currency: GBP
   
2. Create GRN:
   Material: Vitamin Premix
   Quantity: 100 kg
   Unit Cost: £50.00 (GBP)
   Total: £5,000 (GBP)
   
3. System Records:
   - Local Currency: £5,000
   - USD: $6,350 (using rate 1.27)
   
4. Production Impact:
   - Vitamin cost per kg: $63.50 USD
   - Affects formulation cost calculations
```

### Example 3: Local Zimbabwe Supplier

**Scenario:** Buying limestone locally

```
1. Create Supplier:
   Name: Zim Minerals
   Currency: ZWG
   
2. Create GRN:
   Material: Limestone
   Quantity: 5000 kg
   Unit Cost: ZWG 1.35
   Total: ZWG 6,750
   
3. System Records:
   - Local Currency: ZWG 6,750
   - USD: $499.50 (using rate 0.074)
```

---

## Multi-Currency Reporting

### Cost Analysis Report

View production costs across all currencies:

```
Production Order: BATCH-2026-001

Raw Materials (Multi-Currency):
- Maize (ZAR): R 4,625 = $250 USD
- Soya (ZAR): R 5,180 = $280 USD  
- Limestone (ZWG): ZWG 202.50 = $15 USD
- Vitamins (GBP): £39.37 = $50 USD

Total Raw Materials: $595 USD
```

### Supplier Payment Report

Track what you owe in each currency:

```
Payables by Currency:

ZAR (Rand):
- ABC Grains: R 46,250
- SA Soya: R 29,600
Total ZAR: R 75,850 = $4,096 USD

GBP (Pound):
- UK Vitamins: £5,000
Total GBP: £5,000 = $6,350 USD

ZWG (Zim Gold):
- Zim Minerals: ZWG 6,750
Total ZWG: ZWG 6,750 = $500 USD

Grand Total: $10,946 USD
```

---

## Exchange Rate Impact on Costs

### Scenario: Rate Change Impact

**Before Rate Change:**
```
Maize from SA: R 9.25
Rate: 1 ZAR = $0.054 USD
Cost in USD: $0.50
```

**After Rate Change (Rand weakens):**
```
Maize from SA: R 9.25 (same)
Rate: 1 ZAR = $0.050 USD (new rate)
Cost in USD: $0.46 (cheaper!)
```

**Impact:**
- Same Rand price
- Lower USD cost due to exchange rate
- Production costs decrease
- Profit margins improve

### Protecting Against Rate Fluctuations

**Best Practices:**
1. **Lock Rates:** GRN locks exchange rate at receipt date
2. **Regular Updates:** Update rates daily for volatile currencies
3. **Forward Contracts:** Negotiate fixed rates with suppliers
4. **Multi-Source:** Buy from different currency zones to balance risk

---

## Currency Conversion Functions

The system provides helper functions for custom reports:

### Get Exchange Rate
```sql
SELECT get_exchange_rate('ZAR', 'USD', '2026-03-17');
-- Returns: 0.054
```

### Convert Currency
```sql
SELECT convert_currency(100, 'ZAR', 'USD', CURRENT_DATE);
-- Returns: 5.40 (R100 = $5.40)
```

### Multi-Currency View
```sql
SELECT * FROM raw_materials_multi_currency
WHERE code = 'RM-001';

-- Shows costs in all currencies:
-- cost_in_local_currency: R 9.25
-- cost_in_usd: $0.50
-- cost_in_zar: R 9.25
-- cost_in_zwg: ZWG 6.76
-- cost_in_gbp: £0.39
```

---

## Testing Multi-Currency

### Test Case 1: Create Multi-Currency GRN

1. Create supplier in ZAR
2. Create GRN with ZAR prices
3. Verify USD conversion is correct
4. Check both currencies saved

### Test Case 2: Change Exchange Rate

1. Record current rate (e.g., ZAR to USD = 0.054)
2. Create GRN with material cost R 100
3. Verify USD cost = $5.40
4. Update exchange rate to 0.050
5. Create new GRN with same R 100 cost
6. Verify new USD cost = $5.00
7. Check old GRN still shows $5.40 (rate locked)

### Test Case 3: Multi-Currency Production Cost

1. Use materials from different currencies:
   - Maize (ZAR)
   - Vitamins (GBP)
   - Limestone (ZWG)
2. Create production order
3. Verify total cost in USD
4. Check cost breakdown by currency

---

## Common Questions

**Q: Can I change the base currency from USD?**  
A: Yes, but requires system configuration. Contact your administrator.

**Q: How often should I update exchange rates?**  
A: 
- ZWG: Daily (volatile)
- ZAR: Weekly
- USD/GBP: Weekly or when significant changes occur

**Q: What happens if I forget to update rates?**  
A: System uses the last available rate. This may cause inaccurate conversions.

**Q: Can I enter costs directly in USD?**  
A: Yes! If supplier invoices in USD, select USD as currency.

**Q: Do exchange rates affect historical data?**  
A: No. Each transaction locks the rate at transaction date. Historical data remains accurate.

**Q: Can I see profit/loss from exchange rate changes?**  
A: Yes, compare purchase cost in USD vs current converted value.

---

## Best Practices

### 1. Supplier Currency Setup
- Always set supplier default currency
- Matches their invoice currency
- Reduces data entry errors

### 2. Regular Rate Updates
- Schedule daily rate updates
- Use reliable sources (Reserve Bank, Bloomberg)
- Document rate sources for audit

### 3. Transaction Recording
- Enter costs in original currency
- Let system handle conversion
- Never manually convert before entry

### 4. Month-End Procedures
- Update all exchange rates
- Run multi-currency reports
- Reconcile foreign currency accounts
- Calculate exchange gains/losses

### 5. Audit Trail
- System logs all rate changes
- Transaction rates are locked
- Full traceability for compliance

---

## Integration with Sage

### Data Flow

**HYPER MES → Sage:**
```
Production Cost (HYPER MES):
- Raw Materials: $595 USD
- Labour: $50 USD
- Total: $645 USD

Sage Entry:
- Debit: Work in Progress $645
- Credit: Raw Materials $595
- Credit: Wages $50
```

**Multi-Currency Payables:**
```
HYPER MES tracks:
- Supplier: ABC Grains
- Amount: R 46,250 (ZAR)
- USD Equivalent: $2,500

Sage records:
- Accounts Payable: $2,500
- Exchange Rate: 0.054
- Original Currency: ZAR
```

---

## Summary

✅ **4 Currencies Supported:** USD, ZAR, ZWG, GBP  
✅ **Automatic Conversion:** All transactions convert to USD  
✅ **Rate Locking:** Exchange rates locked at transaction date  
✅ **Multi-Currency Reporting:** View costs in any currency  
✅ **Audit Compliant:** Full traceability of rates and conversions  

The multi-currency system ensures accurate costing regardless of supplier location while maintaining standardized USD reporting for management decisions.
