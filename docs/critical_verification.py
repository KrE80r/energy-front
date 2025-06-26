#!/usr/bin/env python3
"""
CRITICAL VERIFICATION SCRIPT
Independent calculation of energy plan costs to verify UI accuracy.
NO assumptions - calculate everything from scratch using raw data.
"""

import json
import math

def load_energy_plans():
    """Load energy plans from JSON file"""
    with open('predicted_energy_plans.json', 'r') as f:
        data = json.load(f)
    return data['plans']['TOU']

def get_personas():
    """Define all persona configurations"""
    return {
        'commuter-no-solar': {
            'name': 'Commuter (No Solar)',
            'quarterlyConsumption': 1900,
            'peakPercent': 40,
            'shoulderPercent': 10,
            'offPeakPercent': 50,
            'solarExport': 0
        },
        'wfh-no-solar': {
            'name': 'Work From Home (No Solar)',
            'quarterlyConsumption': 1900,
            'peakPercent': 70,
            'shoulderPercent': 20,
            'offPeakPercent': 10,
            'solarExport': 0
        },
        'commuter-solar': {
            'name': 'Commuter (With Solar)',
            'quarterlyConsumption': 1900,
            'peakPercent': 25,
            'shoulderPercent': 5,
            'offPeakPercent': 70,
            'solarExport': 1125
        },
        'wfh-solar': {
            'name': 'Work From Home (With Solar)',
            'quarterlyConsumption': 1900,
            'peakPercent': 30,
            'shoulderPercent': 25,
            'offPeakPercent': 45,
            'solarExport': 600
        }
    }

def calculate_plan_cost_python(plan, persona):
    """
    Independent Python implementation of cost calculation
    Using exact same formula as JavaScript version
    """
    # Extract values
    quarterly_consumption = persona['quarterlyConsumption']
    peak_percent = persona['peakPercent']
    shoulder_percent = persona['shoulderPercent']
    offpeak_percent = persona['offPeakPercent']
    solar_export = persona['solarExport']
    
    # Step 1: Supply charge (91 days in quarter)
    supply_charge = (plan['daily_supply_charge'] * 91) / 100
    
    # Step 2: Usage charges
    peak_consumption = quarterly_consumption * (peak_percent / 100)
    shoulder_consumption = quarterly_consumption * (shoulder_percent / 100)
    offpeak_consumption = quarterly_consumption * (offpeak_percent / 100)
    
    usage_charge = 0
    if plan.get('peak_cost'):
        usage_charge += (peak_consumption * plan['peak_cost']) / 100
    if plan.get('shoulder_cost'):
        usage_charge += (shoulder_consumption * plan['shoulder_cost']) / 100
    if plan.get('off_peak_cost'):
        usage_charge += (offpeak_consumption * plan['off_peak_cost']) / 100
    
    # Step 3: Solar credit
    solar_credit = 0
    if plan.get('solar_feed_in_rate_r') and solar_export > 0:
        solar_credit = (solar_export * plan['solar_feed_in_rate_r']) / 100
    
    # Step 4: Total cost
    total_cost = supply_charge + usage_charge - solar_credit
    
    return {
        'total_cost': max(0, total_cost),
        'monthly_cost': max(0, total_cost) / 3,
        'annual_cost': max(0, total_cost) * 4,
        'breakdown': {
            'supply_charge': supply_charge,
            'usage_charge': usage_charge,
            'solar_credit': solar_credit,
            'peak_consumption': peak_consumption,
            'shoulder_consumption': shoulder_consumption,
            'offpeak_consumption': offpeak_consumption
        }
    }

def get_test_plans():
    """Get 6 diverse plans for comprehensive testing"""
    plans = load_energy_plans()
    
    test_plans = []
    retailers_found = set()
    
    # Priority plans to find
    priority_retailers = ['AGL', 'Origin Energy', 'CovaU', 'Energy Locals', 'Simply Energy', 'Alinta Energy']
    
    # First pass: get one plan from each priority retailer
    for retailer in priority_retailers:
        for plan in plans:
            if plan['retailer_name'] == retailer and retailer not in retailers_found:
                test_plans.append(plan)
                retailers_found.add(retailer)
                break
    
    # Second pass: fill remaining slots with other retailers
    for plan in plans:
        if len(test_plans) >= 6:
            break
        if plan['retailer_name'] not in retailers_found:
            test_plans.append(plan)
            retailers_found.add(plan['retailer_name'])
    
    return test_plans[:6]  # Return max 6 plans

def main():
    print("=" * 80)
    print("CRITICAL VERIFICATION: Independent Cost Calculation")
    print("=" * 80)
    print()
    
    personas = get_personas()
    test_plans = get_test_plans()
    
    # Remove None plans
    test_plans = [p for p in test_plans if p is not None]
    
    print(f"Testing {len(test_plans)} plans across {len(personas)} personas")
    print()
    
    # Create summary table for quick comparison
    print("📊 SUMMARY TABLE (Quarterly Costs)")
    print("=" * 120)
    
    # Header
    header = "Persona".ljust(25)
    for i, plan in enumerate(test_plans, 1):
        retailer = plan['retailer_name'][:12]  # Truncate long names
        header += f"{retailer}".ljust(15)
    print(header)
    print("-" * 120)
    
    # Calculate all combinations
    all_results = {}
    for persona_key, persona in personas.items():
        row = persona['name'].ljust(25)
        persona_results = []
        
        for plan in test_plans:
            result = calculate_plan_cost_python(plan, persona)
            persona_results.append(result)
            row += f"${result['total_cost']:.0f}".ljust(15)
        
        all_results[persona_key] = persona_results
        print(row)
    
    print("=" * 120)
    print()
    
    # Detailed breakdown for each persona
    for persona_key, persona in personas.items():
        print(f"🧑‍💼 DETAILED BREAKDOWN: {persona['name']}")
        print(f"   📋 Pattern: {persona['quarterlyConsumption']} kWh, {persona['peakPercent']}%P/{persona['shoulderPercent']}%S/{persona['offPeakPercent']}%O, {persona['solarExport']} kWh solar")
        print()
        
        persona_results = all_results[persona_key]
        
        # Sort plans by cost for this persona
        sorted_plans = sorted(zip(test_plans, persona_results), key=lambda x: x[1]['total_cost'])
        
        for rank, (plan, result) in enumerate(sorted_plans, 1):
            status = "🥇 CHEAPEST" if rank == 1 else "🥈 2nd BEST" if rank == 2 else f"#{rank}"
            
            print(f"   {status} {plan['retailer_name']} - {plan['plan_name']}")
            print(f"      💰 ${result['total_cost']:.2f}/quarter (${result['monthly_cost']:.2f}/month)")
            
            # Show breakdown for top 3 plans
            if rank <= 3:
                print(f"         Supply: ${result['breakdown']['supply_charge']:.2f} | Usage: ${result['breakdown']['usage_charge']:.2f} | Solar: -${result['breakdown']['solar_credit']:.2f}")
            print()
        
        print("-" * 80)
        print()
    
    print("🔍 VERIFICATION CHECKS:")
    print()
    
    # Specific test cases mentioned in conversation
    custom_369_pattern = {
        'quarterlyConsumption': 369,
        'peakPercent': 50,
        'shoulderPercent': 30,
        'offPeakPercent': 20,
        'solarExport': 0
    }
    
    agl_plan = test_plans[0]  # AGL
    origin_plan = test_plans[1] if len(test_plans) > 1 else test_plans[0]  # Origin
    
    print("✅ Test Case 1: 369 kWh with 50% peak, 30% shoulder, 20% off-peak (NO SOLAR)")
    agl_result = calculate_plan_cost_python(agl_plan, custom_369_pattern)
    origin_result = calculate_plan_cost_python(origin_plan, custom_369_pattern)
    
    print(f"   AGL Market Offer TOU: ${agl_result['total_cost']:.2f}")
    print(f"   Expected: $282.82")
    print(f"   Match: {'✅ YES' if abs(agl_result['total_cost'] - 282.82) < 0.1 else '❌ NO'}")
    print()
    
    print(f"   Origin Go Variable: ${origin_result['total_cost']:.2f}")
    print(f"   Expected: $255.03")
    print(f"   Match: {'✅ YES' if abs(origin_result['total_cost'] - 255.03) < 0.1 else '❌ NO'}")
    print()
    
    print("🚨 CRITICAL ISSUES TO CHECK:")
    print()
    
    # Check for common bugs
    commuter_no_solar = personas['commuter-no-solar']
    agl_commuter_result = calculate_plan_cost_python(agl_plan, commuter_no_solar)
    
    print(f"1. Commuter No-Solar should have HIGH costs (no solar benefit)")
    print(f"   AGL for commuter-no-solar: ${agl_commuter_result['total_cost']:.2f}")
    print(f"   If this shows ~$190, there's a SOLAR EXPORT BUG")
    print(f"   Status: {'❌ BUG DETECTED' if agl_commuter_result['total_cost'] < 500 else '✅ LOOKS CORRECT'}")
    print()
    
    print(f"2. Solar personas should have LOWER costs than non-solar")
    commuter_solar = personas['commuter-solar']
    agl_solar_result = calculate_plan_cost_python(agl_plan, commuter_solar)
    
    print(f"   AGL commuter-no-solar: ${agl_commuter_result['total_cost']:.2f}")
    print(f"   AGL commuter-solar: ${agl_solar_result['total_cost']:.2f}")
    print(f"   Solar should be lower: {'✅ CORRECT' if agl_solar_result['total_cost'] < agl_commuter_result['total_cost'] else '❌ BUG'}")
    print()
    
    print("🎯 SPECIFIC UI VERIFICATION TESTS:")
    print()
    
    test_cases = [
        ("Commuter (No Solar)", personas['commuter-no-solar']),
        ("Work From Home (No Solar)", personas['wfh-no-solar']),
        ("Commuter (With Solar)", personas['commuter-solar']),
        ("Work From Home (With Solar)", personas['wfh-solar'])
    ]
    
    for test_name, test_persona in test_cases:
        print(f"📝 TEST: Select '{test_name}' persona")
        
        # Test with first 3 plans
        for i, plan in enumerate(test_plans[:3], 1):
            result = calculate_plan_cost_python(plan, test_persona)
            print(f"   Plan {i} ({plan['retailer_name']}): Should show ${result['total_cost']:.2f}")
        print()
    
    print("🔧 CUSTOM SETTINGS TEST:")
    print("1. Select any persona")  
    print("2. Click 'Customize Usage'")
    print("3. Set: 369 kWh, Peak 50%, Shoulder 30%, Off-Peak 20%")
    print("4. Verify results match:")
    
    custom_pattern = {
        'quarterlyConsumption': 369,
        'peakPercent': 50,
        'shoulderPercent': 30,
        'offPeakPercent': 20,
        'solarExport': 0
    }
    
    for i, plan in enumerate(test_plans[:3], 1):
        result = calculate_plan_cost_python(plan, custom_pattern)
        print(f"   Plan {i} ({plan['retailer_name']}): ${result['total_cost']:.2f}")
    print()
    
    print("⚠️  RED FLAGS - Report if you see:")
    print("• Any cost under $200 for non-solar personas")
    print("• Solar personas costing MORE than non-solar")
    print("• Identical costs across different personas")
    print("• Costs not updating when you change custom settings")

if __name__ == "__main__":
    main()