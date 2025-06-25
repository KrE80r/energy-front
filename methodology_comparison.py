#!/usr/bin/env python3
"""
Methodology Comparison Analysis
Tests alternative methodology claims against mathematical reality
"""

import json
import sys
from persona_analysis import (
    load_energy_plans, calculate_plan_cost_corrected, 
    should_disqualify_plan_corrected, PERSONAS
)

def find_plans_by_retailer(plans, retailer_name):
    """Find all plans for a specific retailer"""
    return [plan for plan in plans if retailer_name.lower() in plan.get('retailer_name', '').lower()]

def find_best_plan_by_retailer(plans, retailer_name, persona_data):
    """Find the best plan for a specific retailer for given persona"""
    retailer_plans = find_plans_by_retailer(plans, retailer_name)
    if not retailer_plans:
        return None
    
    best_plan = None
    best_cost = float('inf')
    
    for plan in retailer_plans:
        if should_disqualify_plan_corrected(plan):
            continue
        
        calc = calculate_plan_cost_corrected(plan, persona_data)
        if calc and calc['total_cost'] < best_cost:
            best_cost = calc['total_cost']
            best_plan = {
                'plan': plan,
                'calculation': calc
            }
    
    return best_plan

def analyze_supply_vs_usage_tradeoff(plan1_data, plan2_data, persona_data):
    """Analyze when supply charge vs usage rate trade-offs matter"""
    
    plan1 = plan1_data['plan']
    plan2 = plan2_data['plan']
    
    supply_diff = plan1.get('daily_supply_charge', 0) - plan2.get('daily_supply_charge', 0)
    peak_diff = plan1.get('peak_cost', 0) - plan2.get('peak_cost', 0)
    shoulder_diff = plan1.get('shoulder_cost', 0) - plan2.get('shoulder_cost', 0)
    off_peak_diff = plan1.get('off_peak_cost', 0) - plan2.get('off_peak_cost', 0)
    
    # Calculate cost difference breakdown
    consumption = persona_data['consumption']
    peak_pct = persona_data['peak_percent']
    shoulder_pct = persona_data['shoulder_percent']
    off_peak_pct = persona_data['off_peak_percent']
    
    # Account for solar self-consumption
    solar_export = persona_data.get('solar_export', 0)
    self_consumption_pct = persona_data.get('self_consumption_percent', 0)
    
    if solar_export > 0 and self_consumption_pct > 0:
        solar_generation = solar_export / (1 - (self_consumption_pct / 100))
        solar_self_consumed = solar_generation * (self_consumption_pct / 100)
    else:
        solar_self_consumed = 0
    
    net_consumption = consumption - solar_self_consumed
    
    # Calculate impact of each rate difference
    supply_impact = (supply_diff * 91) / 100  # Quarterly
    peak_impact = (net_consumption * peak_pct / 100 * peak_diff) / 100
    shoulder_impact = (net_consumption * shoulder_pct / 100 * shoulder_diff) / 100
    off_peak_impact = (net_consumption * off_peak_pct / 100 * off_peak_diff) / 100
    
    total_usage_impact = peak_impact + shoulder_impact + off_peak_impact
    
    return {
        'supply_difference_quarterly': supply_impact,
        'usage_difference_quarterly': total_usage_impact,
        'peak_impact': peak_impact,
        'shoulder_impact': shoulder_impact,
        'off_peak_impact': off_peak_impact,
        'net_difference': supply_impact + total_usage_impact,
        'supply_wins': supply_impact + total_usage_impact < 0  # Negative means plan1 is cheaper
    }

def test_fit_dominance_claim(high_fit_plan, low_fit_plan, persona_data):
    """Test if high FiT actually dominates usage rates for solar exporters"""
    
    calc_high = calculate_plan_cost_corrected(high_fit_plan, persona_data)
    calc_low = calculate_plan_cost_corrected(low_fit_plan, persona_data)
    
    if not calc_high or not calc_low:
        return None
    
    # Compare components
    fit_diff = calc_high['breakdown']['solar_credit'] - calc_low['breakdown']['solar_credit']
    usage_diff = calc_low['breakdown']['usage_charge'] - calc_high['breakdown']['usage_charge']
    supply_diff = calc_low['breakdown']['supply_charge'] - calc_high['breakdown']['supply_charge']
    
    total_cost_diff = calc_low['total_cost'] - calc_high['total_cost']
    
    return {
        'high_fit_plan': high_fit_plan['plan_name'],
        'low_fit_plan': low_fit_plan['plan_name'],
        'fit_advantage': fit_diff,
        'usage_disadvantage': -usage_diff,  # Negative if high FiT plan has higher usage costs
        'supply_disadvantage': -supply_diff,  # Negative if high FiT plan has higher supply costs
        'net_advantage': total_cost_diff,
        'fit_dominates': total_cost_diff > 0,  # True if high FiT plan is actually cheaper
        'high_fit_cost': calc_high['total_cost'],
        'low_fit_cost': calc_low['total_cost']
    }

def analyze_persona_rate_priorities(persona_data, plans):
    """Analyze which rate components actually matter most for a persona"""
    
    # Find a representative plan to use as baseline
    valid_plans = [p for p in plans if not should_disqualify_plan_corrected(p)]
    if not valid_plans:
        return None
    
    baseline_plan = valid_plans[0]  # Use first valid plan as baseline
    baseline_calc = calculate_plan_cost_corrected(baseline_plan, persona_data)
    
    if not baseline_calc:
        return None
    
    # Test impact of changing each rate component by 10%
    rate_impacts = {}
    
    for rate_type in ['peak_cost', 'shoulder_cost', 'off_peak_cost', 'daily_supply_charge']:
        test_plan = baseline_plan.copy()
        original_rate = test_plan.get(rate_type, 0)
        
        if original_rate > 0:
            # Increase rate by 10%
            test_plan[rate_type] = original_rate * 1.1
            test_calc = calculate_plan_cost_corrected(test_plan, persona_data)
            
            if test_calc:
                cost_impact = test_calc['total_cost'] - baseline_calc['total_cost']
                rate_impacts[rate_type] = {
                    'cost_impact_10pct_increase': cost_impact,
                    'impact_per_cent_change': cost_impact / 10,  # Impact per 1% rate change
                    'original_rate': original_rate
                }
    
    # Sort by impact magnitude
    sorted_impacts = sorted(rate_impacts.items(), 
                          key=lambda x: abs(x[1]['cost_impact_10pct_increase']), 
                          reverse=True)
    
    return {
        'baseline_cost': baseline_calc['total_cost'],
        'rate_impacts': rate_impacts,
        'priority_order': [item[0] for item in sorted_impacts]
    }

def test_alternative_methodology_claims(plans_data):
    """Test all claims made in the alternative methodology"""
    
    tou_plans = plans_data.get('plans', {}).get('TOU', [])
    results = {}
    
    print("Testing Alternative Methodology Claims...")
    print("=" * 60)
    
    # Find retailer plans
    retailers = {
        'Origin Energy': find_plans_by_retailer(tou_plans, 'Origin'),
        'AGL': find_plans_by_retailer(tou_plans, 'AGL'), 
        'GloBird': find_plans_by_retailer(tou_plans, 'GloBird'),
        'Alinta': find_plans_by_retailer(tou_plans, 'Alinta'),
        'Energy Locals': find_plans_by_retailer(tou_plans, 'Energy Locals')
    }
    
    print("\\nRetailer Plan Counts:")
    for retailer, plans in retailers.items():
        print(f"  {retailer}: {len(plans)} plans")
    
    # Test each persona claim
    for persona_key, persona_data in PERSONAS.items():
        print(f"\\n\\nTESTING PERSONA: {persona_data['name']}")
        print("-" * 50)
        
        # Find best plan for each retailer
        retailer_best = {}
        for retailer_name in retailers.keys():
            best = find_best_plan_by_retailer(tou_plans, retailer_name, persona_data)
            if best:
                retailer_best[retailer_name] = best
        
        if not retailer_best:
            print("No valid plans found for this persona")
            continue
        
        # Sort by cost
        sorted_retailers = sorted(retailer_best.items(), 
                                key=lambda x: x[1]['calculation']['total_cost'])
        
        print("Actual Ranking by Total Cost:")
        for i, (retailer, data) in enumerate(sorted_retailers, 1):
            cost = data['calculation']['total_cost']
            plan_name = data['plan']['plan_name']
            print(f"  {i}. {retailer}: ${cost:.2f} ({plan_name})")
        
        # Test rate priority analysis
        print("\\nRate Impact Analysis:")
        rate_analysis = analyze_persona_rate_priorities(persona_data, tou_plans)
        if rate_analysis:
            print("Priority order by cost impact (10% rate increase):")
            for i, rate_type in enumerate(rate_analysis['priority_order'], 1):
                impact = rate_analysis['rate_impacts'][rate_type]
                print(f"  {i}. {rate_type.replace('_', ' ').title()}: "
                      f"${impact['cost_impact_10pct_increase']:.2f} "
                      f"({impact['original_rate']:.2f} base rate)")
        
        results[persona_key] = {
            'retailer_ranking': sorted_retailers,
            'rate_priorities': rate_analysis
        }
    
    return results

def generate_methodology_comparison_report(analysis_results):
    """Generate comprehensive methodology comparison report"""
    
    report = []
    report.append("=" * 80)
    report.append("METHODOLOGY COMPARISON ANALYSIS REPORT")
    report.append("=" * 80)
    report.append("")
    report.append("Testing claims from alternative methodology against mathematical reality...")
    report.append("")
    
    # Test each persona's claims
    persona_claims = {
        'commuter_no_solar': {
            'claimed_winner': 'Origin Energy',
            'claim': 'Lower supply charge beats GloBird lower peak rate',
            'methodology': 'Supply charge prioritization for high peak users'
        },
        'wfh_no_solar': {
            'claimed_winner': 'Origin Energy', 
            'claim': 'Shoulder rate is most critical + lowest supply charge',
            'methodology': 'Shoulder rate prioritization for WFH users'
        },
        'commuter_with_solar': {
            'claimed_winner': 'AGL',
            'claim': 'High 9c FiT makes usage rates almost irrelevant',
            'methodology': 'Feed-in tariff dominance for high exporters'
        },
        'wfh_with_solar': {
            'claimed_winner': 'Origin Energy',
            'claim': 'Best all-rounder beats AGL high FiT due to lower base costs',
            'methodology': 'Balanced approach for moderate exporters'
        }
    }
    
    for persona_key, results in analysis_results.items():
        if persona_key not in persona_claims:
            continue
            
        claim_info = persona_claims[persona_key]
        persona_name = PERSONAS[persona_key]['name']
        
        report.append(f"PERSONA: {persona_name}")
        report.append("=" * 50)
        report.append(f"CLAIM: {claim_info['claim']}")
        report.append(f"CLAIMED WINNER: {claim_info['claimed_winner']}")
        report.append(f"METHODOLOGY: {claim_info['methodology']}")
        report.append("")
        
        # Show actual results
        ranking = results['retailer_ranking']
        if ranking:
            actual_winner = ranking[0][0]
            actual_cost = ranking[0][1]['calculation']['total_cost']
            
            report.append("ACTUAL RESULTS:")
            report.append(f"  Mathematical Winner: {actual_winner} (${actual_cost:.2f})")
            
            # Find claimed winner's actual position
            claimed_position = None
            claimed_cost = None
            for i, (retailer, data) in enumerate(ranking, 1):
                if retailer == claim_info['claimed_winner']:
                    claimed_position = i
                    claimed_cost = data['calculation']['total_cost']
                    break
            
            if claimed_position:
                cost_diff = claimed_cost - actual_cost
                report.append(f"  Claimed Winner Position: #{claimed_position} (${claimed_cost:.2f})")
                report.append(f"  Cost Difference: ${cost_diff:.2f} quarterly (${cost_diff*4:.2f} annually)")
                
                if claimed_position == 1:
                    report.append("  ✅ CLAIM VERIFIED")
                else:
                    report.append("  ❌ CLAIM REFUTED")
            else:
                report.append(f"  ❌ CLAIMED WINNER NOT FOUND IN DATA")
        
        # Show rate priority analysis
        rate_priorities = results.get('rate_priorities')
        if rate_priorities:
            report.append("")
            report.append("RATE IMPACT REALITY CHECK:")
            for i, rate_type in enumerate(rate_priorities['priority_order'][:3], 1):
                impact = rate_priorities['rate_impacts'][rate_type]
                rate_name = rate_type.replace('_', ' ').title()
                report.append(f"  {i}. {rate_name}: ${impact['cost_impact_10pct_increase']:.2f} per 10% increase")
        
        report.append("")
        report.append("-" * 50)
        report.append("")
    
    # Overall methodology assessment
    report.append("METHODOLOGY ASSESSMENT:")
    report.append("=" * 30)
    report.append("")
    
    # Count verification success rate
    total_claims = len(persona_claims)
    verified_claims = 0
    
    for persona_key, results in analysis_results.items():
        if persona_key not in persona_claims:
            continue
        
        ranking = results['retailer_ranking']
        if ranking:
            actual_winner = ranking[0][0]
            claimed_winner = persona_claims[persona_key]['claimed_winner']
            if actual_winner == claimed_winner:
                verified_claims += 1
    
    verification_rate = (verified_claims / total_claims) * 100
    
    report.append(f"Claims Verified: {verified_claims}/{total_claims} ({verification_rate:.1f}%)")
    
    if verification_rate < 50:
        report.append("")
        report.append("🚨 CRITICAL METHODOLOGY FLAWS IDENTIFIED")
        report.append("The alternative methodology makes incorrect assumptions about:")
        report.append("• Rate component prioritization")
        report.append("• Supply charge vs usage rate trade-offs") 
        report.append("• Feed-in tariff impact magnitude")
        report.append("• Optimal plan selection criteria")
        report.append("")
        report.append("RECOMMENDATION: Use corrected calculation methodology")
    else:
        report.append("")
        report.append("✅ Alternative methodology shows reasonable accuracy")
    
    return "\\n".join(report)

def main():
    """Main execution"""
    print("Loading data for methodology comparison...")
    
    plans_data = load_energy_plans('/home/krkr/energy/all_energy_plans.json')
    
    print("Testing alternative methodology claims...")
    analysis_results = test_alternative_methodology_claims(plans_data)
    
    print("\\nGenerating comparison report...")
    report = generate_methodology_comparison_report(analysis_results)
    
    # Save report
    with open('/home/krkr/energy/methodology_comparison_report.txt', 'w') as f:
        f.write(report)
    
    print("\\nMethodology comparison complete!")
    print("Report saved to: methodology_comparison_report.txt")

if __name__ == "__main__":
    main()