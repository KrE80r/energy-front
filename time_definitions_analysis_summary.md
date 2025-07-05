# Energy Plan Time Definitions Analysis Summary

**Analysis Date:** 2025-07-05  
**Data Source:** `/home/krkr/energy/docs/all_energy_plans.json`  
**Data Extraction Date:** 2025-06-26  
**Total Plans Analyzed:** 146 TOU (Time of Use) plans  

## Key Findings

### Most Common Time Patterns

#### 🔴 **Peak Hours**
**Dominant Pattern:** `06:00-09:59 + 15:00-00:59` (6am-10am + 3pm-1am)
- **Plans:** 45 (30.8%)
- **Pattern:** Morning peak from 6am-10am, afternoon/evening peak from 3pm until 1am (next day)

#### 🟡 **Shoulder Hours**  
**Dominant Pattern:** `10:00-14:59` (10am-3pm)
- **Plans:** 82 (56.2%)
- **Pattern:** Midday period from 10am-3pm

#### 🟢 **Off-Peak Hours**
**Dominant Pattern:** `01:00-05:59` (1am-6am)
- **Plans:** 80 (54.8%)
- **Pattern:** Late night/early morning from 1am-6am

### Overall Most Common Pattern
**43 plans (29.5%)** use the exact same time structure:
- **Peak:** 6am-10am + 3pm-1am
- **Shoulder:** 10am-3pm  
- **Off-Peak:** 1am-6am

## Detailed Pattern Analysis

### Peak Time Variations

| Pattern | Plans | Percentage | Description |
|---------|-------|------------|-------------|
| `06:00-09:59 + 15:00-00:59` | 45 | 30.8% | Morning + afternoon/evening peak |
| `06:00-09:59 + 16:00-23:59` | 40 | 27.4% | Morning + afternoon/evening (no midnight) |
| `00:00-00:59 + 06:00-09:59 + 15:00-23:59` | 26 | 17.8% | Midnight + morning + afternoon/evening |
| `17:00-20:59` | 17 | 11.6% | Evening only peak |
| `15:00-00:59 + 06:00-09:59` | 9 | 6.2% | Same as #1 (reordered) |
| Others | 9 | 6.2% | Various other patterns |

### Shoulder Time Variations

| Pattern | Plans | Percentage | Description |
|---------|-------|------------|-------------|
| `10:00-14:59` | 82 | 56.2% | Standard midday shoulder |
| `10:00-15:59` | 42 | 28.8% | Extended midday shoulder |
| `00:00-09:59 + 16:00-16:59 + 21:00-23:59` | 8 | 5.5% | Complex pattern with gaps |
| `00:00-05:59` | 5 | 3.4% | Early morning shoulder |
| Others | 9 | 6.2% | Various other patterns |

### Off-Peak Time Variations

| Pattern | Plans | Percentage | Description |
|---------|-------|------------|-------------|
| `01:00-05:59` | 80 | 54.8% | Standard late night/early morning |
| `00:00-05:59` | 37 | 25.3% | Extended early morning |
| `10:00-15:59` | 15 | 10.3% | Midday off-peak (unusual) |
| `00:00-09:59 + 16:00-16:59 + 21:00-23:59` | 7 | 4.8% | Complex pattern with gaps |
| Others | 7 | 4.8% | Various other patterns |

## Pattern Diversity

- **Peak patterns:** 10 different variations
- **Shoulder patterns:** 7 different variations  
- **Off-peak patterns:** 8 different variations

## Business Implications

### For Consumers
1. **Predictable Structure:** The majority of plans (56.2%) follow a consistent shoulder period of 10am-3pm
2. **Peak Avoidance:** Most plans charge peak rates during 6am-10am and 3pm-1am, making midday (10am-3pm) and very early morning (1am-6am) the cheapest times
3. **Solar Advantage:** Many plans offer cheaper rates during 10am-3pm, which aligns well with solar generation periods

### For System Development
1. **Standard Pattern:** Can use the most common pattern (43 plans) as the default assumption
2. **Fallback Logic:** Need to handle at least 3 major peak patterns covering 76% of plans
3. **Edge Cases:** 25 patterns cover the remaining 24% of plans, requiring flexible time parsing

### Time-of-Use Recommendations
**Best times to use electricity:**
1. **1am-6am** (Off-peak) - Lowest rates on 54.8% of plans
2. **10am-3pm** (Shoulder) - Moderate rates on 56.2% of plans, often coincides with solar generation

**Avoid these times:**
1. **6am-10am** (Peak) - High rates on 76% of plans
2. **3pm-11pm** (Peak) - High rates on most plans
3. **11pm-1am** (Peak) - High rates on 48.6% of plans

## Retailer Examples Using Most Common Pattern

The following retailers use the standard pattern (Peak: 6am-10am + 3pm-1am, Shoulder: 10am-3pm, Off-Peak: 1am-6am):

- ENGIE
- Dodo  
- RAA Energy
- Red Energy
- OVO Energy
- Sumo Power
- Alinta Energy
- AGL
- Origin Energy
- And 34 others

---

*This analysis provides a comprehensive overview of time-of-use patterns across all available energy plans in South Australia, helping consumers understand when electricity is cheapest and most expensive across different retailers.*