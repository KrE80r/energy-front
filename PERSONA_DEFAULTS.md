# Persona Default Usage Patterns

This document details the default usage patterns for each household persona in the Energy Plan Advisor.

## 📊 Usage Pattern Assumptions

All personas are based on **21.1 kWh/day average usage** (1900 kWh quarterly consumption) as referenced in the application title.

### 🏠 **Commuter (No Solar)**
**Profile**: Away during day, evening usage pattern
```
Peak Usage:     15%  (4-9pm weekdays)
Shoulder Usage: 25%  (7-10am, 9-10pm weekdays + 7am-10pm weekends)
Off-Peak Usage: 60%  (10pm-7am + public holidays)

Solar Generation:        0 kWh/quarter
Self-Consumption:        0%
```

**Rationale**: Low peak usage as household members are away at work during expensive evening peak hours (4-9pm). Higher off-peak usage for overnight appliances, morning routines, and weekend activities.

---

### 🏠 **Work From Home (No Solar)**
**Profile**: High daytime usage pattern
```
Peak Usage:     45%  (4-9pm weekdays)
Shoulder Usage: 35%  (7-10am, 9-10pm weekdays + 7am-10pm weekends)
Off-Peak Usage: 20%  (10pm-7am + public holidays)

Solar Generation:        0 kWh/quarter
Self-Consumption:        0%
```

**Rationale**: High peak usage due to working from home during expensive 4-9pm peak period. Air conditioning, computers, lighting, and appliances running during peak times. Lower off-peak usage as most consumption happens during active daytime hours.

---

### 🌞 **Commuter (With Solar)**
**Profile**: Solar export during day, minimal self-consumption
```
Peak Usage:     10%  (4-9pm weekdays)
Shoulder Usage: 20%  (7-10am, 9-10pm weekdays + 7am-10pm weekends)
Off-Peak Usage: 70%  (10pm-7am + public holidays)

Solar Generation:        1500 kWh/quarter (typical 5kW system in SA)
Self-Consumption:        25%
```

**Rationale**: Very low daytime consumption means most solar is exported to grid. Peak usage further reduced by battery storage or solar carryover effects. Higher off-peak usage for charging electric vehicles, pool pumps, and overnight appliances when solar isn't generating.

---

### 🌞 **Work From Home (With Solar)**
**Profile**: High self-consumption during solar generation hours
```
Peak Usage:     30%  (4-9pm weekdays)
Shoulder Usage: 40%  (7-10am, 9-10pm weekdays + 7am-10pm weekends)
Off-Peak Usage: 30%  (10pm-7am + public holidays)

Solar Generation:        1500 kWh/quarter (typical 5kW system in SA)
Self-Consumption:        60%
```

**Rationale**: High self-consumption as household is occupied during solar generation hours. Peak usage significantly reduced from 45% to 30% due to solar offset during 4-9pm period. More balanced usage across all periods due to solar optimization.

## ⚡ Time of Use (TOU) Period Definitions

Based on typical South Australian TOU tariff structures:

### Peak Hours
- **Weekdays**: 4:00 PM - 9:00 PM
- **Weekends**: No peak pricing
- **Public Holidays**: No peak pricing

### Shoulder Hours
- **Weekdays**: 7:00 AM - 10:00 AM, 9:00 PM - 10:00 PM
- **Weekends**: 7:00 AM - 10:00 PM
- **Public Holidays**: 7:00 AM - 10:00 PM

### Off-Peak Hours
- **Daily**: 10:00 PM - 7:00 AM
- **Public Holidays**: All day off-peak rates apply

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
Peak Consumption:     1900 × 15% = 285 kWh
Shoulder Consumption: 1900 × 25% = 475 kWh
Off-Peak Consumption: 1900 × 60% = 1140 kWh
Solar Self-Consumed:  0 kWh
Net Grid Consumption: 1900 kWh
Solar Exported:       0 kWh
```

### Work From Home (With Solar) - 1900 kWh Quarterly
```
Peak Consumption:     1900 × 30% = 570 kWh
Shoulder Consumption: 1900 × 40% = 760 kWh
Off-Peak Consumption: 1900 × 30% = 570 kWh
Solar Generation:     1500 kWh
Solar Self-Consumed:  1500 × 60% = 900 kWh
Net Grid Consumption: 1900 - 900 = 1000 kWh
Solar Exported:       1500 - 900 = 600 kWh
```

These patterns provide realistic starting points while allowing full customization for precise calculations based on actual household data.