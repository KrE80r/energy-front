#!/usr/bin/env python3
"""
Energy Plan Cost Comparison for Commuter Profile without Solar
Comparing 4 plans: AGL Custom, Globird, Momentum, Energy Locals
"""

# Average quarterly consumption for SA household: ~1600 kWh
# Smart commuter profile with free-hours optimization:
# - Can shift dishwasher, washing machine, dryer to free 10am-1pm on weekends
# - 15% of usage can be shifted to free hours (dishwasher, laundry, some cooking)
# - Remaining usage distributed across other periods
QUARTERLY_USAGE = 1600  # kWh per quarter

# Usage breakdown for smart commuter with free-hour optimization:
# - Fridge runs constantly but 3 hours daily (10am-1pm) are free
# - Can shift dishwasher, washing machine, dryer to free hours on weekends
# - 18% of total usage happens during free hours (fridge baseline + shifted appliances)
FREE_HOURS_PERCENTAGE = 0.18   # Fridge (12.5%) + shifted appliances (5.5%)
PEAK_PERCENTAGE = 0.28         # Reduced from 35% (shifted some to free hours)
SHOULDER_1_PERCENTAGE = 0.14   # 1pm-3pm usage  
OFF_PEAK_PERCENTAGE = 0.40     # Night/early morning unchanged

# Calculate usage by time period
free_hours_usage = QUARTERLY_USAGE * FREE_HOURS_PERCENTAGE  # 10am-1pm (free on new AGL plan)
peak_usage = QUARTERLY_USAGE * PEAK_PERCENTAGE
shoulder_1_usage = QUARTERLY_USAGE * SHOULDER_1_PERCENTAGE  # 1pm-3pm
off_peak_usage = QUARTERLY_USAGE * OFF_PEAK_PERCENTAGE

print(f"Quarterly Usage Profile (Smart Commuter, No Solar):")
print(f"Total: {QUARTERLY_USAGE} kWh")
print(f"Free hours (10am-1pm): {free_hours_usage} kWh ({FREE_HOURS_PERCENTAGE*100}%)")
print(f"Peak: {peak_usage} kWh ({PEAK_PERCENTAGE*100}%)")
print(f"Shoulder 1 (1pm-3pm): {shoulder_1_usage} kWh ({SHOULDER_1_PERCENTAGE*100}%)")
print(f"Off-peak: {off_peak_usage} kWh ({OFF_PEAK_PERCENTAGE*100}%)")
print("-" * 60)

# Plan data (all rates include GST)
plans = {
    "AGL Free Hours Plan": {
        "supply_charge": 127.69,  # c/day
        "rates": {
            "peak": 54.19,      # c/kWh (6am-9:59am, 3pm-11:59pm, 12am-12:59am)
            "off_peak": 35.21,  # c/kWh (1am-5:59am)
            "free_hours": 0.00, # c/kWh (10am-12:59pm) FREE!
            "shoulder_1": 24.90 # c/kWh (1pm-2:59pm)
        },
        "plan_type": "tou_with_free"
    },
    
    "Globird": {
        "supply_charge": 140.80,  # c/day
        "rates": {
            "peak": 42.57,     # c/kWh (3pm-11:59pm, 12am-12:59am, 6am-9:59am)
            "off_peak": 24.97,  # c/kWh (1am-5:59am)
            "free_hours": 24.97, # c/kWh (10am-1pm) - not free on this plan
            "shoulder_1": 24.97  # c/kWh (1pm-3pm)
        },
        "plan_type": "tou"
    },
    
    "Momentum": {
        "supply_charge": 170.06,  # c/day
        "rates": {
            "peak": 40.04,     # c/kWh (6am-9:59am, 4pm-11:59pm)
            "off_peak": 31.35,  # c/kWh (12am-5:59am)
            "free_hours": 27.17, # c/kWh (10am-1pm) - not free on this plan
            "shoulder_1": 27.17  # c/kWh (1pm-3pm)
        },
        "plan_type": "tou"
    },
    
    "Energy Locals": {
        "supply_charge": 153.50,  # c/day
        "rates": {
            "peak": 43.00,     # c/kWh (6am-9:59am, 4pm-11:59pm)
            "off_peak": 32.50,  # c/kWh (12am-5:59am)
            "free_hours": 27.00, # c/kWh (10am-1pm) - not free on this plan
            "shoulder_1": 27.00  # c/kWh (1pm-3pm)
        },
        "plan_type": "tou"
    }
}

# Calculate costs for each plan
results = {}

for plan_name, plan_data in plans.items():
    # Supply charge for quarter (91 days)
    supply_cost = (plan_data["supply_charge"] * 91) / 100  # Convert cents to dollars
    
    # Time of Use calculation with free hours support
    usage_cost = (
        (peak_usage * plan_data["rates"]["peak"]) +
        (free_hours_usage * plan_data["rates"]["free_hours"]) +  # FREE on AGL plan!
        (shoulder_1_usage * plan_data["rates"]["shoulder_1"]) +
        (off_peak_usage * plan_data["rates"]["off_peak"])
    ) / 100  # Convert cents to dollars
    
    total_cost = supply_cost + usage_cost
    
    results[plan_name] = {
        "supply_cost": supply_cost,
        "usage_cost": usage_cost,
        "total_cost": total_cost
    }
    
    print(f"{plan_name}:")
    print(f"  Supply charge: ${supply_cost:.2f}")
    print(f"  Usage charge:  ${usage_cost:.2f}")
    print(f"  Total cost:    ${total_cost:.2f}")
    print()

# Find cheapest plan
cheapest_plan = min(results.items(), key=lambda x: x[1]["total_cost"])
most_expensive = max(results.items(), key=lambda x: x[1]["total_cost"])

print("=" * 60)
print("COMPARISON SUMMARY:")
print("=" * 60)

# Sort by cost
sorted_plans = sorted(results.items(), key=lambda x: x[1]["total_cost"])

for i, (plan_name, costs) in enumerate(sorted_plans, 1):
    savings = most_expensive[1]["total_cost"] - costs["total_cost"]
    print(f"{i}. {plan_name}: ${costs['total_cost']:.2f}")
    if i > 1:
        print(f"   (${savings:.2f} cheaper than most expensive)")

print(f"\nCHEAPEST: {cheapest_plan[0]} at ${cheapest_plan[1]['total_cost']:.2f}/quarter")
savings_vs_expensive = most_expensive[1]["total_cost"] - cheapest_plan[1]["total_cost"]
print(f"SAVINGS: ${savings_vs_expensive:.2f}/quarter vs most expensive")
print(f"ANNUAL SAVINGS: ${savings_vs_expensive * 4:.2f}/year")