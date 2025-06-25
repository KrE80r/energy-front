#!/usr/bin/env python3
"""
Energy Plan Persona Analysis
Analyzes all available TOU plans to find optimal recommendations for different user personas
"""

import json
import sys
from typing import Dict, List, Tuple, Optional

def load_energy_plans(filepath: str) -> Dict:
    """Load energy plans from JSON file"""
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: Could not find file {filepath}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in {filepath}: {e}")
        sys.exit(1)

def calculate_plan_cost_corrected(plan_data: Dict, usage_pattern: Dict) -> Optional[Dict]:
    """
    Calculate electricity costs using the CORRECTED unified formula
    Based on real bill analysis - applies TOU rates to net grid consumption
    """
    try:
        # Extract usage pattern values
        quarterly_consumption = usage_pattern['consumption']
        peak_percent = usage_pattern['peak_percent']
        shoulder_percent = usage_pattern['shoulder_percent'] 
        off_peak_percent = usage_pattern['off_peak_percent']
        solar_export = usage_pattern['solar_export']
        self_consumption_percent = usage_pattern['self_consumption_percent']
        
        # Validate inputs
        if quarterly_consumption <= 0:
            return None
        if abs((peak_percent + shoulder_percent + off_peak_percent) - 100) > 0.1:
            return None
        if solar_export < 0 or self_consumption_percent < 0:
            return None
            
        # Step 1: Calculate Fixed Supply Charge (91 days)
        daily_supply_rate = plan_data.get('daily_supply_charge', 0)
        supply_charge = (daily_supply_rate * 91) / 100  # Convert cents to dollars
        
        # Step 2: Calculate Solar Generation and Self-Consumption
        if solar_export > 0 and self_consumption_percent > 0:
            # Reverse engineer total solar generation from export and self-consumption rate
            solar_generation = solar_export / (1 - (self_consumption_percent / 100))
            solar_self_consumed = solar_generation * (self_consumption_percent / 100)
        else:
            solar_generation = solar_export  # If no self-consumption, generation = export
            solar_self_consumed = 0
            
        # Step 3: Calculate Net Grid Consumption (what was actually bought from grid)
        net_grid_consumption = quarterly_consumption - solar_self_consumed
        
        # Validate net consumption is not negative
        if net_grid_consumption < 0:
            return None
            
        # Step 4: Apply TOU rates to NET GRID CONSUMPTION (not total consumption)
        peak_consumption = net_grid_consumption * (peak_percent / 100)
        shoulder_consumption = net_grid_consumption * (shoulder_percent / 100)
        off_peak_consumption = net_grid_consumption * (off_peak_percent / 100)
        
        usage_charge = 0
        
        # Apply rates (convert cents to dollars)
        peak_rate = plan_data.get('peak_cost', 0)
        if peak_rate and peak_consumption > 0:
            usage_charge += (peak_consumption * peak_rate) / 100
            
        shoulder_rate = plan_data.get('shoulder_cost', 0)
        if shoulder_rate and shoulder_consumption > 0:
            usage_charge += (shoulder_consumption * shoulder_rate) / 100
            
        off_peak_rate = plan_data.get('off_peak_cost', 0)
        if off_peak_rate and off_peak_consumption > 0:
            usage_charge += (off_peak_consumption * off_peak_rate) / 100
        
        # Step 5: Calculate Solar Export Credit
        feed_in_rate = plan_data.get('solar_feed_in_rate_r', 0) or 0
        solar_credit = (solar_export * feed_in_rate) / 100 if feed_in_rate > 0 else 0
        
        # Step 6: Calculate Final Bill
        final_bill = supply_charge + usage_charge - solar_credit
        
        return {
            'total_cost': max(0, final_bill),
            'monthly_cost': max(0, final_bill) / 3,
            'annual_cost': max(0, final_bill) * 4,
            'breakdown': {
                'supply_charge': supply_charge,
                'usage_charge': usage_charge,
                'solar_credit': solar_credit,
                'net_grid_consumption': net_grid_consumption,
                'solar_self_consumed': solar_self_consumed,
                'solar_generation': solar_generation
            },
            'plan_data': plan_data
        }
        
    except (KeyError, TypeError, ZeroDivisionError) as e:
        print(f"Error calculating cost for plan {plan_data.get('plan_name', 'Unknown')}: {e}")
        return None

def should_disqualify_plan_corrected(plan_data: Dict) -> bool:
    """
    Corrected plan disqualification logic
    Allow legitimate 2-rate TOU plans (peak/off-peak only)
    """
    # Check for obviously invalid plans with zero rates
    peak_rate = plan_data.get('peak_cost', 0)
    off_peak_rate = plan_data.get('off_peak_cost', 0)
    
    # Must have valid peak and off-peak rates
    if not peak_rate or not off_peak_rate or peak_rate <= 0 or off_peak_rate <= 0:
        return True
        
    # Shoulder rate can be null/zero for legitimate 2-rate plans
    # Only disqualify if shoulder rate exists but is suspiciously zero
    shoulder_rate = plan_data.get('shoulder_cost')
    if shoulder_rate is not None and shoulder_rate <= 0:
        # Only disqualify if there are detailed time blocks showing shoulder period exists
        detailed_blocks = plan_data.get('detailed_time_blocks', [])
        has_shoulder_block = any(block.get('time_of_use_period') == 'S' for block in detailed_blocks)
        if has_shoulder_block:
            return True  # Has shoulder period but zero rate - suspicious
    
    return False

# Define realistic persona usage patterns based on TOU structure analysis
PERSONAS = {
    "commuter_no_solar": {
        "name": "Commuter (No Solar)",
        "description": "Works away from home 9am-5pm, high peak usage",
        "consumption": 1500,  # kWh quarterly
        "peak_percent": 70,   # Morning prep + evening home (6am-10am, 3pm-1am)
        "shoulder_percent": 10,  # Minimal usage 10am-3pm (away at work)
        "off_peak_percent": 20,  # Some late night usage 1am-6am
        "solar_export": 0,
        "self_consumption_percent": 0
    },
    "wfh_no_solar": {
        "name": "Work From Home (No Solar)", 
        "description": "Home all day, balanced usage across periods",
        "consumption": 1800,  # Higher overall consumption
        "peak_percent": 60,   # Still significant peak usage
        "shoulder_percent": 25,  # More daytime usage (working from home)
        "off_peak_percent": 15,  # Less late night usage
        "solar_export": 0,
        "self_consumption_percent": 0
    },
    "commuter_with_solar": {
        "name": "Commuter + Solar",
        "description": "Away during solar hours, maximizes export",
        "consumption": 1500,
        "peak_percent": 70,   # Same consumption pattern as non-solar commuter
        "shoulder_percent": 10,
        "off_peak_percent": 20,
        "solar_export": 800,  # High export (away during 10am-3pm generation)
        "self_consumption_percent": 20  # Low self-consumption
    },
    "wfh_with_solar": {
        "name": "Work From Home + Solar",
        "description": "Home during solar hours, higher self-consumption", 
        "consumption": 1800,
        "peak_percent": 60,   # Same base consumption as WFH no solar
        "shoulder_percent": 25,
        "off_peak_percent": 15,
        "solar_export": 400,  # Lower export (home during generation)
        "self_consumption_percent": 40  # Higher self-consumption
    }
}

def analyze_plans_for_persona(plans: List[Dict], persona_key: str, persona_data: Dict) -> List[Dict]:
    """Analyze all plans for a specific persona and return ranked results"""
    results = []
    
    for plan in plans:
        # Skip disqualified plans
        if should_disqualify_plan_corrected(plan):
            continue
            
        calculation = calculate_plan_cost_corrected(plan, persona_data)
        if calculation:
            calculation['persona'] = persona_key
            results.append(calculation)
    
    # Sort by total cost (cheapest first)
    results.sort(key=lambda x: x['total_cost'])
    return results

def generate_persona_analysis_report(persona_results: Dict[str, List[Dict]]) -> str:
    """Generate comprehensive analysis report"""
    report = []
    report.append("=" * 80)
    report.append("ENERGY PLAN PERSONA ANALYSIS REPORT")
    report.append("=" * 80)
    report.append("")
    
    for persona_key, results in persona_results.items():
        persona_info = PERSONAS[persona_key]
        report.append(f"PERSONA: {persona_info['name']}")
        report.append(f"Description: {persona_info['description']}")
        report.append(f"Usage Pattern: {persona_info['consumption']} kWh quarterly")
        report.append(f"TOU Split: {persona_info['peak_percent']}% peak, {persona_info['shoulder_percent']}% shoulder, {persona_info['off_peak_percent']}% off-peak")
        if persona_info['solar_export'] > 0:
            report.append(f"Solar: {persona_info['solar_export']} kWh export, {persona_info['self_consumption_percent']}% self-consumption")
        report.append("")
        
        if not results:
            report.append("No valid plans found for this persona.")
            report.append("")
            continue
            
        report.append("TOP 5 CHEAPEST PLANS:")
        report.append("-" * 50)
        
        for i, result in enumerate(results[:5], 1):
            plan = result['plan_data']
            breakdown = result['breakdown']
            
            report.append(f"{i}. {plan['plan_name']} ({plan['retailer_name']})")
            report.append(f"   Quarterly Cost: ${result['total_cost']:.2f}")
            report.append(f"   Monthly Cost: ${result['monthly_cost']:.2f}")
            report.append(f"   Annual Cost: ${result['annual_cost']:.2f}")
            report.append("")
            report.append("   Rate Structure:")
            report.append(f"   - Peak Rate: {plan.get('peak_cost', 0):.2f} c/kWh")
            report.append(f"   - Shoulder Rate: {plan.get('shoulder_cost', 0):.2f} c/kWh") 
            report.append(f"   - Off-Peak Rate: {plan.get('off_peak_cost', 0):.2f} c/kWh")
            report.append(f"   - Daily Supply: {plan.get('daily_supply_charge', 0):.2f} c/day")
            if plan.get('solar_feed_in_rate_r'):
                report.append(f"   - Feed-in Tariff: {plan.get('solar_feed_in_rate_r', 0):.2f} c/kWh")
            report.append("")
            report.append("   Cost Breakdown:")
            report.append(f"   - Supply Charge: ${breakdown['supply_charge']:.2f}")
            report.append(f"   - Usage Charge: ${breakdown['usage_charge']:.2f}")
            if breakdown['solar_credit'] > 0:
                report.append(f"   - Solar Credit: -${breakdown['solar_credit']:.2f}")
                report.append(f"   - Net Grid Consumption: {breakdown['net_grid_consumption']:.1f} kWh")
                report.append(f"   - Solar Self-Consumed: {breakdown['solar_self_consumed']:.1f} kWh")
            report.append("")
        
        # Calculate savings potential
        if len(results) > 1:
            cheapest = results[0]['total_cost'] 
            most_expensive = results[-1]['total_cost']
            potential_savings = most_expensive - cheapest
            report.append(f"SAVINGS POTENTIAL: Up to ${potential_savings:.2f} quarterly (${potential_savings*4:.2f} annually)")
            report.append("")
        
        report.append("=" * 50)
        report.append("")
    
    return "\n".join(report)

def main():
    """Main analysis execution"""
    print("Loading energy plans data...")
    
    # Load plans data
    plans_data = load_energy_plans('/home/krkr/energy/all_energy_plans.json')
    tou_plans = plans_data.get('plans', {}).get('TOU', [])
    
    print(f"Loaded {len(tou_plans)} TOU plans")
    print("Starting persona analysis...")
    
    # Analyze each persona
    persona_results = {}
    for persona_key, persona_data in PERSONAS.items():
        print(f"Analyzing {persona_data['name']}...")
        results = analyze_plans_for_persona(tou_plans, persona_key, persona_data)
        persona_results[persona_key] = results
        print(f"Found {len(results)} valid plans for {persona_data['name']}")
    
    # Generate report
    report = generate_persona_analysis_report(persona_results)
    
    # Save report to file
    with open('/home/krkr/energy/persona_analysis_report.txt', 'w') as f:
        f.write(report)
    
    print("\nAnalysis complete!")
    print("Report saved to: persona_analysis_report.txt")
    print("\nPreview of results:")
    print("=" * 50)
    
    # Show summary for each persona
    for persona_key, results in persona_results.items():
        persona_name = PERSONAS[persona_key]['name']
        if results:
            cheapest_cost = results[0]['total_cost']
            cheapest_plan = results[0]['plan_data']['plan_name']
            print(f"{persona_name}: ${cheapest_cost:.2f} quarterly ({cheapest_plan})")
        else:
            print(f"{persona_name}: No valid plans found")

if __name__ == "__main__":
    main()