#!/usr/bin/env python3
"""
Rate Sensitivity Analysis
Analyzes which rate components matter most for each persona to achieve maximum savings
"""

import json
import sys
from persona_analysis import (
    load_energy_plans, calculate_plan_cost_corrected, 
    should_disqualify_plan_corrected, PERSONAS
)

def calculate_rate_impact(plan_data, usage_pattern):
    """Calculate the impact of each rate component on total cost"""
    calculation = calculate_plan_cost_corrected(plan_data, usage_pattern)
    if not calculation:
        return None
    
    breakdown = calculation['breakdown']
    total_cost = calculation['total_cost']
    
    # Calculate percentage impact of each component
    supply_impact = (breakdown['supply_charge'] / total_cost) * 100
    usage_impact = (breakdown['usage_charge'] / total_cost) * 100
    solar_impact = (breakdown['solar_credit'] / total_cost) * 100 if breakdown['solar_credit'] > 0 else 0
    
    # Calculate TOU breakdown within usage charge
    quarterly_consumption = usage_pattern['consumption']
    peak_percent = usage_pattern['peak_percent']
    shoulder_percent = usage_pattern['shoulder_percent'] 
    off_peak_percent = usage_pattern['off_peak_percent']
    
    # Account for solar self-consumption
    solar_self_consumed = breakdown['solar_self_consumed']
    net_grid_consumption = quarterly_consumption - solar_self_consumed
    
    peak_consumption = net_grid_consumption * (peak_percent / 100)
    shoulder_consumption = net_grid_consumption * (shoulder_percent / 100)
    off_peak_consumption = net_grid_consumption * (off_peak_percent / 100)
    
    peak_cost = (peak_consumption * plan_data.get('peak_cost', 0)) / 100
    shoulder_cost = (shoulder_consumption * plan_data.get('shoulder_cost', 0)) / 100 if plan_data.get('shoulder_cost') else 0
    off_peak_cost = (off_peak_consumption * plan_data.get('off_peak_cost', 0)) / 100
    
    return {
        'total_cost': total_cost,
        'supply_impact_pct': supply_impact,
        'usage_impact_pct': usage_impact,
        'solar_impact_pct': solar_impact,
        'peak_cost': peak_cost,
        'shoulder_cost': shoulder_cost,
        'off_peak_cost': off_peak_cost,
        'peak_impact_pct': (peak_cost / total_cost) * 100,
        'shoulder_impact_pct': (shoulder_cost / total_cost) * 100,
        'off_peak_impact_pct': (off_peak_cost / total_cost) * 100,
        'net_grid_consumption': net_grid_consumption,
        'solar_self_consumed': solar_self_consumed
    }

def find_rate_leaders(plans, persona_data):
    """Find plans with best rates for each component"""
    valid_plans = [p for p in plans if not should_disqualify_plan_corrected(p)]
    
    # Find leaders in each category
    lowest_peak = min(valid_plans, key=lambda p: p.get('peak_cost', float('inf')))
    lowest_shoulder = min(valid_plans, key=lambda p: p.get('shoulder_cost', float('inf')) if p.get('shoulder_cost') else float('inf'))
    lowest_off_peak = min(valid_plans, key=lambda p: p.get('off_peak_cost', float('inf')))
    lowest_supply = min(valid_plans, key=lambda p: p.get('daily_supply_charge', float('inf')))
    highest_fit = max(valid_plans, key=lambda p: p.get('solar_feed_in_rate_r', 0) or 0)
    
    # Calculate what each would cost for this persona
    leaders = {}
    
    for category, plan in [
        ('peak', lowest_peak),
        ('shoulder', lowest_shoulder), 
        ('off_peak', lowest_off_peak),
        ('supply', lowest_supply),
        ('feed_in', highest_fit)
    ]:
        calc = calculate_plan_cost_corrected(plan, persona_data)
        if calc:
            leaders[category] = {
                'plan_name': plan['plan_name'],
                'retailer_name': plan['retailer_name'],
                'cost': calc['total_cost'],
                'rate_value': {
                    'peak': plan.get('peak_cost', 0),
                    'shoulder': plan.get('shoulder_cost', 0),
                    'off_peak': plan.get('off_peak_cost', 0),
                    'supply': plan.get('daily_supply_charge', 0),
                    'feed_in': plan.get('solar_feed_in_rate_r', 0) or 0
                }[category]
            }
    
    return leaders

def analyze_optimization_opportunities(plans, persona_data):
    """Analyze what happens if we could cherry-pick the best rates"""
    valid_plans = [p for p in plans if not should_disqualify_plan_corrected(p)]
    
    # Find the absolute best rates
    best_peak = min(p.get('peak_cost', float('inf')) for p in valid_plans)
    best_shoulder = min(p.get('shoulder_cost', float('inf')) for p in valid_plans if p.get('shoulder_cost'))
    best_off_peak = min(p.get('off_peak_cost', float('inf')) for p in valid_plans)
    best_supply = min(p.get('daily_supply_charge', float('inf')) for p in valid_plans)
    best_fit = max(p.get('solar_feed_in_rate_r', 0) or 0 for p in valid_plans)
    
    # Create hypothetical "perfect" plan
    perfect_plan = {
        'peak_cost': best_peak,
        'shoulder_cost': best_shoulder,
        'off_peak_cost': best_off_peak,
        'daily_supply_charge': best_supply,
        'solar_feed_in_rate_r': best_fit,
        'plan_name': 'Hypothetical Perfect Plan',
        'retailer_name': 'N/A'
    }
    
    perfect_calc = calculate_plan_cost_corrected(perfect_plan, persona_data)
    
    # Find actual cheapest plan for comparison
    cheapest_actual = None
    cheapest_cost = float('inf')
    
    for plan in valid_plans:
        calc = calculate_plan_cost_corrected(plan, persona_data)
        if calc and calc['total_cost'] < cheapest_cost:
            cheapest_cost = calc['total_cost']
            cheapest_actual = calc
    
    return perfect_calc, cheapest_actual

def generate_sensitivity_report(plans_data, personas):
    """Generate comprehensive rate sensitivity analysis"""
    report = []
    report.append("=" * 80)
    report.append("RATE SENSITIVITY ANALYSIS REPORT")
    report.append("=" * 80)
    report.append("")
    
    tou_plans = plans_data.get('plans', {}).get('TOU', [])
    
    for persona_key, persona_data in personas.items():
        report.append(f"PERSONA: {persona_data['name']}")
        report.append("=" * 50)
        report.append("")
        
        # Find rate leaders
        leaders = find_rate_leaders(tou_plans, persona_data)
        
        report.append("RATE COMPONENT ANALYSIS:")
        report.append("-" * 30)
        
        # Calculate impact using cheapest plan
        cheapest_plans = [p for p in tou_plans if not should_disqualify_plan_corrected(p)]
        cheapest_plans.sort(key=lambda p: calculate_plan_cost_corrected(p, persona_data)['total_cost'] if calculate_plan_cost_corrected(p, persona_data) else float('inf'))
        
        if cheapest_plans:
            cheapest_plan = cheapest_plans[0]
            impact = calculate_rate_impact(cheapest_plan, persona_data)
            
            if impact:
                report.append(f"Using cheapest plan: {cheapest_plan['plan_name']} (${impact['total_cost']:.2f} quarterly)")
                report.append("")
                report.append("Cost Component Breakdown:")
                report.append(f"  Supply Charge Impact: {impact['supply_impact_pct']:.1f}% (${impact['total_cost'] * impact['supply_impact_pct']/100:.2f})")
                report.append(f"  Peak Usage Impact: {impact['peak_impact_pct']:.1f}% (${impact['peak_cost']:.2f})")
                if impact['shoulder_cost'] > 0:
                    report.append(f"  Shoulder Usage Impact: {impact['shoulder_impact_pct']:.1f}% (${impact['shoulder_cost']:.2f})")
                report.append(f"  Off-Peak Usage Impact: {impact['off_peak_impact_pct']:.1f}% (${impact['off_peak_cost']:.2f})")
                if impact['solar_impact_pct'] > 0:
                    report.append(f"  Solar Credit Impact: -{impact['solar_impact_pct']:.1f}% (-${impact['total_cost'] * impact['solar_impact_pct']/100:.2f})")
                report.append("")
                
                # Identify priority optimization areas
                usage_impacts = [
                    ('Peak Rate', impact['peak_impact_pct']),
                    ('Shoulder Rate', impact['shoulder_impact_pct']),
                    ('Off-Peak Rate', impact['off_peak_impact_pct'])
                ]
                usage_impacts.sort(key=lambda x: x[1], reverse=True)
                
                report.append("OPTIMIZATION PRIORITIES:")
                for i, (component, pct) in enumerate(usage_impacts, 1):
                    if pct > 0:
                        report.append(f"  {i}. {component}: {pct:.1f}% of total cost")
                report.append("")
        
        # Rate leaders analysis
        report.append("BEST RATES AVAILABLE:")
        report.append("-" * 25)
        for category, leader in leaders.items():
            category_name = category.replace('_', ' ').title()
            if category == 'feed_in':
                report.append(f"{category_name} Tariff Leader: {leader['plan_name']} ({leader['rate_value']:.2f} c/kWh)")
            elif category == 'supply':
                report.append(f"{category_name} Charge Leader: {leader['plan_name']} ({leader['rate_value']:.2f} c/day)")
            else:
                report.append(f"{category_name} Rate Leader: {leader['plan_name']} ({leader['rate_value']:.2f} c/kWh)")
            report.append(f"  Would cost: ${leader['cost']:.2f} quarterly")
        report.append("")
        
        # Optimization potential
        perfect_calc, cheapest_actual = analyze_optimization_opportunities(tou_plans, persona_data)
        if perfect_calc and cheapest_actual:
            potential_savings = cheapest_actual['total_cost'] - perfect_calc['total_cost']
            report.append("THEORETICAL OPTIMIZATION POTENTIAL:")
            report.append(f"  Current best plan: ${cheapest_actual['total_cost']:.2f} quarterly")
            report.append(f"  Theoretical perfect plan: ${perfect_calc['total_cost']:.2f} quarterly")
            report.append(f"  Unrealized potential: ${potential_savings:.2f} quarterly (${potential_savings*4:.2f} annually)")
            report.append("")
        
        report.append("=" * 50)
        report.append("")
    
    return "\n".join(report)

def main():
    """Main execution"""
    print("Loading data for rate sensitivity analysis...")
    
    plans_data = load_energy_plans('/home/krkr/energy/all_energy_plans.json')
    
    print("Generating rate sensitivity analysis...")
    report = generate_sensitivity_report(plans_data, PERSONAS)
    
    # Save report
    with open('/home/krkr/energy/rate_sensitivity_report.txt', 'w') as f:
        f.write(report)
    
    print("Rate sensitivity analysis complete!")
    print("Report saved to: rate_sensitivity_report.txt")

if __name__ == "__main__":
    main()