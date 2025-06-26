# Persona Default Usage Patterns

This document details the default usage patterns for each household persona in the Energy Plan Advisor.

## 📊 Usage Pattern Assumptions

All personas are based on **21.1 kWh/day average usage** (1900 kWh quarterly consumption) as referenced in the application title.

### 🏠 **Commuter (No Solar)**
**Profile**: Away during day, evening usage pattern
```
Peak Usage:     40%  (6-10am morning routine + 3pm-1am evening usage)
Shoulder Usage: 10%  (10am-3pm when away at work)
Off-Peak Usage: 50%  (1-6am overnight appliances, hot water systems)

Solar Generation:        0 kWh/quarter
Self-Consumption:        0%
```

**Rationale**: Away during cheapest shoulder period (10am-3pm), but unavoidable usage during expensive 18-hour peak periods for morning routines and evening activities. Maximize overnight off-peak usage with timers and smart appliances.

---

### 🏠 **Work From Home (No Solar)**
**Profile**: High daytime usage pattern
```
Peak Usage:     70%  (6-10am + 3pm-1am - home during 18-hour peak period)
Shoulder Usage: 20%  (10am-3pm working hours)
Off-Peak Usage: 10%  (1-6am limited overnight usage)

Solar Generation:        0 kWh/quarter
Self-Consumption:        0%
```

**Rationale**: Worst-case scenario for this TOU structure - home during 75% of peak pricing hours daily. Air conditioning, computers, lighting, and appliances running during expensive peak times. This tariff structure is punitive for WFH households without solar.

---

### 🌞 **Commuter (With Solar)**
**Profile**: Solar export during day, minimal self-consumption
```
Peak Usage:     25%  (6-10am + 3pm-1am reduced by solar offset)
Shoulder Usage:  5%  (10am-3pm away during peak solar generation)
Off-Peak Usage: 70%  (1-6am maximize cheapest period usage)

Solar Generation:        1500 kWh/quarter (typical 5kW system in SA)
Self-Consumption:        25%
```

**Rationale**: Ideal scenario - away during shoulder period when solar generates most, maximizing export revenue. Solar credits offset some peak usage costs. Smart load shifting to off-peak period (1-6am) for major appliances, EV charging, and pool pumps.

---

### 🌞 **Work From Home (With Solar)**
**Profile**: High self-consumption during solar generation hours
```
Peak Usage:     30%  (6-10am + 3pm-1am significantly reduced by solar)
Shoulder Usage: 25%  (10am-3pm high self-consumption during solar peak)
Off-Peak Usage: 45%  (1-6am smart load shifting)

Solar Generation:        1500 kWh/quarter (typical 5kW system in SA)
Self-Consumption:        60%
```

**Rationale**: Best positioned for this TOU structure - home during shoulder period (10am-3pm) for maximum self-consumption when solar generates most. Solar significantly reduces grid consumption during peak periods. Smart household can shift remaining loads to off-peak hours (1-6am).

## ⚡ Time of Use (TOU) Period Definitions

Based on typical South Australian TOU tariff structures:

### Peak Hours
- **Daily**: 6:00 AM - 10:00 AM & 3:00 PM - 1:00 AM (next day)
- **Duration**: 18 hours per day (75% of day)

### Shoulder Hours  
- **Daily**: 10:00 AM - 3:00 PM
- **Duration**: 5 hours per day (21% of day)
- **Note**: "Solar sponge" period aligning with peak solar generation

### Off-Peak Hours
- **Daily**: 1:00 AM - 6:00 AM
- **Duration**: 5 hours per day (21% of day)

## 🔢 Solar System Assumptions

### Typical 5kW Solar System in SA
- **Quarterly Generation**: 1500 kWh (varies by season)
- **Daily Average**: 16.5 kWh (higher in summer, lower in winter)
- **Peak Generation**: 10:00 AM - 2:00 PM

### Self-Consumption Patterns
- **Commuter Households**: 25% (away during peak solar hours)
- **Work From Home**: 60% (present during peak solar hours)
- **Export to Grid**: Remaining generation after self-consumption

## 📈 Usage Pattern Validation

These default patterns are based on:

1. **SA Energy Usage Data**: Government statistics on household consumption
2. **TOU Pricing Impact**: How pricing signals affect usage behavior
3. **Solar PV Performance**: Typical solar generation patterns in SA
4. **Household Occupancy**: Work patterns and lifestyle factors

## 🎯 Customization Options

Users can override these defaults by:
1. Clicking "Customize Usage" after selecting a persona
2. Adjusting quarterly consumption (kWh)
3. Setting custom peak/shoulder/off-peak percentages
4. Entering actual solar generation and self-consumption data

## 🔄 Percentage Validation

The application ensures:
- Peak + Shoulder + Off-Peak = 100%
- Self-consumption ≤ 100%
- Solar generation ≥ 0
- All percentages between 0-100%

## 📊 Example Calculations

### Commuter (No Solar) - 1900 kWh Quarterly
```
Peak Consumption:     1900 × 40% = 760 kWh
Shoulder Consumption: 1900 × 10% = 190 kWh
Off-Peak Consumption: 1900 × 50% = 950 kWh
Solar Self-Consumed:  0 kWh
Net Grid Consumption: 1900 kWh
Solar Exported:       0 kWh
```

### Work From Home (With Solar) - 1900 kWh Quarterly
```
Peak Consumption:     1900 × 30% = 570 kWh
Shoulder Consumption: 1900 × 25% = 475 kWh
Off-Peak Consumption: 1900 × 45% = 855 kWh
Solar Generation:     1500 kWh
Solar Self-Consumed:  1500 × 60% = 900 kWh
Net Grid Consumption: 1900 - 900 = 1000 kWh
Solar Exported:       1500 - 900 = 600 kWh
```

These patterns provide realistic starting points while allowing full customization for precise calculations based on actual household data.