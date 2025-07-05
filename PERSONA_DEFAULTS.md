# Persona Default Usage Patterns

This document details the default usage patterns for each household persona in the Energy Plan Advisor.

## 📊 Usage Pattern Assumptions

All personas are based on **15 kWh/day average usage** (1365 kWh quarterly consumption) as referenced in the application title.

### 🏠 **Commuter (No Solar)**
**Profile**: Away during day, evening usage pattern
```
Peak Usage:     75%  (6-10am morning routine + 3pm-1am evening usage)
Shoulder Usage:  8%  (10am-3pm when away at work - weekend usage only)
Off-Peak Usage: 17%  (1-6am hot water system timed for off-peak)

Solar Generation:        0 kWh/quarter
Self-Consumption:        0%
```

**Rationale**: Some basic energy awareness, hot water on timer. Away during cheapest shoulder period but unavoidable peak usage for morning routines and evening activities. Realistic off-peak usage limited to automated loads.

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
**Profile**: Solar export during day, moderate self-consumption
```
Peak Usage:     70%  (6-10am + 3pm-1am moderate solar usage pattern)
Shoulder Usage:  8%  (10am-3pm away during peak solar generation)
Off-Peak Usage: 22%  (1-6am balanced load shifting)

Solar Generation:        1500 kWh/quarter (typical 5kW system in SA)
Self-Consumption:        20%
Solar Export:            1200 kWh/quarter
```

**Rationale**: Moderate usage with some weekend solar utilization. Good balance between export revenue and load shifting to off-peak period.

---

### 🌞 **Work From Home (With Solar)**
**Profile**: High self-consumption during solar generation hours
```
Peak Usage:     65%  (6-10am + 3pm-1am reduced by solar self-consumption)
Shoulder Usage: 25%  (10am-3pm good usage during solar generation)
Off-Peak Usage: 10%  (1-6am limited overnight optimization)

Solar Generation:        1500 kWh/quarter (typical 5kW system in SA)
Self-Consumption:        45%
Solar Export:            825 kWh/quarter
```

**Rationale**: Regular work setup with good solar utilization during work hours. Solar reduces peak usage costs through self-consumption during shoulder period.

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
- **Commuter Households**: 20% (away during peak solar hours) → Export: 1200 kWh/quarter
- **Work From Home**: 45% (present during peak solar hours) → Export: 825 kWh/quarter

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

### Commuter (No Solar) - 1365 kWh Quarterly
```
Peak Consumption:     1365 × 75% = 1024 kWh
Shoulder Consumption: 1365 × 8% = 109 kWh
Off-Peak Consumption: 1365 × 17% = 232 kWh
Solar Self-Consumed:  0 kWh
Net Grid Consumption: 1365 kWh
Solar Exported:       0 kWh
```

### Work From Home (With Solar) - 1365 kWh Quarterly
```
Peak Consumption:     1365 × 65% = 887 kWh
Shoulder Consumption: 1365 × 25% = 341 kWh
Off-Peak Consumption: 1365 × 10% = 137 kWh
Solar Generation:     1500 kWh
Solar Self-Consumed:  1500 × 45% = 675 kWh
Net Grid Consumption: 1365 - 675 = 690 kWh
Solar Exported:       825 kWh
```

These patterns provide realistic starting points while allowing full customization for precise calculations based on actual household data.