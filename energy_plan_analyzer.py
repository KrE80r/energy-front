#!/usr/bin/env python3
"""
Energy Plan Analyzer - Comprehensive Analysis for All Personas
Analyzes the cheapest energy plans for different household personas with variations
"""

import json
import math
from datetime import datetime
from typing import Dict, List, Tuple, Optional

class EnergyPlanAnalyzer:
    def __init__(self, data_file: str):
        """Initialize the analyzer with energy plans data"""
        self.data_file = data_file
        self.plans_data = None
        self.filtered_plans = []
        self.load_data()
        self.filter_plans()
        
    def load_data(self):
        """Load energy plans data from JSON file"""
        with open(self.data_file, 'r') as f:
            data = json.load(f)
        self.plans_data = data.get('plans', {}).get('TOU', [])
        print(f"Loaded {len(self.plans_data)} energy plans")
        
    def filter_plans(self):
        """Filter plans based on effective date and exclusion list (matching JS code)"""
        target_date = '2025-06-17'
        
        # Exclusion list from app.js
        restricted_plan_ids = [
            # SC (Seniors Card) Restrictions
            "AGL360486MRE33", "AGL898888MRE3",
            
            # OC (Other Customer Requirements) Restrictions
            "AGL100677MRE45", "AGL360621MRE32", "AGL686236MRE19", "AGL726430MRE17",
            "AGL726436MRE22", "AGL733560MRE17", "AGL827771MRE6", "AGL840896MRE6",
            "AGL898820MRE3", "AGL898840MRE3", "AGL907767MRE2", "AGL907790MRE2",
            "ALI849388MRE3", "ALI875577MRE3", "ENE676768MRE8", "ENE676773MRE8",
            "ENG938049SRE1", "ENG938141MRE1", "ENG938152MRE1", "ENG938161MRE1",
            "ENG938177MRE1", "ENG938181MRE1", "ENG939788MRE1", "ENG939829MRE1",
            "LUM203108MRE20", "ORI539830MRE15", "ORI665045MRE13", "ORI727571MRE7",
            "ORI848686MRE5", "ORI848791MRE3", "OVO723748MRE13", "OVO723789MRE13",
            "RED552636MRE13", "RED927290MRE1"
        ]
        
        original_count = len(self.plans_data)
        
        # Filter by effective date
        valid_plans = []
        for plan in self.plans_data:
            effective_date = plan.get('raw_plan_data_complete', {}).get('detailed_api_response', {}).get('data', {}).get('planData', {}).get('effectiveDate')
            
            if effective_date and effective_date >= target_date:
                valid_plans.append(plan)
        
        after_date_filter = len(valid_plans)
        
        # Filter out restricted plans
        after_restricted_filter = [plan for plan in valid_plans if plan.get('plan_id') not in restricted_plan_ids]
        
        # Filter out Kogan Energy plans
        after_kogan_filter = [plan for plan in after_restricted_filter if plan.get('retailer_name') != 'Kogan Energy']
        
        # Filter out EV-only plans (ENGIE EV Flex)
        self.filtered_plans = [plan for plan in after_kogan_filter if not ('EV Flex' in plan.get('plan_name', '') or 'EV' in plan.get('plan_name', '') and 'ENGIE' in plan.get('retailer_name', ''))]
        
        restricted_filtered = after_date_filter - len(after_restricted_filter)
        kogan_filtered = len(after_restricted_filter) - len(after_kogan_filter)
        ev_filtered = len(after_kogan_filter) - len(self.filtered_plans)
        final_count = len(self.filtered_plans)
        
        print(f"Filtered plans: {original_count} → {after_date_filter} (after date filter) → {len(after_restricted_filter)} (after exclusions) → {len(after_kogan_filter)} (after removing Kogan) → {final_count} (after removing EV plans)")
        print(f"Removed: {restricted_filtered} restricted plans, {kogan_filtered} Kogan Energy plans, {ev_filtered} EV-only plans")
        
    def get_persona_variations(self) -> Dict[str, List[Dict]]:
        """Define realistic persona variations with mathematically sound time usage ratios
        
        Time Reality Check:
        - Peak: 6am-10am & 3pm-1am = 14 hours/day (58.3%)
        - Shoulder: 10am-3pm = 5 hours/day (20.8%)  
        - Off-Peak: 1am-6am = 5 hours/day (20.8%)
        
        Realistic Constraints:
        - Off-Peak max ~25% (people sleep 1-6am, only automated loads possible)
        - Commuters: Low shoulder (away at work 10am-3pm)
        - WFH: Higher shoulder (home and working 10am-3pm)
        - Peak naturally dominates (58.3% of day)
        """
        return {
            "Commuter (No Solar)": [
                {
                    "name": "Inefficient Commuter",
                    "description": "No energy management, all appliances run when convenient (peak hours)",
                    "quarterly_consumption": 1365,
                    "peak_percent": 85,  # Most usage during convenient peak hours
                    "shoulder_percent": 5,   # Away at work 10am-3pm
                    "off_peak_percent": 10,  # Only automatic overnight loads (fridge, etc.)
                    "solar_generation": 0,
                    "self_consumption_percent": 0,
                    "solar_export": 0
                },
                {
                    "name": "Standard Commuter", 
                    "description": "Some basic energy awareness, hot water on timer",
                    "quarterly_consumption": 1365,
                    "peak_percent": 75,  # Typical usage pattern
                    "shoulder_percent": 8,   # Minimal - weekend/holiday usage only
                    "off_peak_percent": 17,  # Hot water system timed for off-peak
                    "solar_generation": 0,
                    "self_consumption_percent": 0,
                    "solar_export": 0
                },
                {
                    "name": "Optimized Commuter",
                    "description": "Smart home setup: EV charging, pool pump, dishwasher all timed 1-6am",
                    "quarterly_consumption": 1365,
                    "peak_percent": 65,  # Reduced through smart scheduling
                    "shoulder_percent": 10,  # Weekend usage only
                    "off_peak_percent": 25,  # Maximum realistic optimization (EV, pool, appliances)
                    "solar_generation": 0,
                    "self_consumption_percent": 0,
                    "solar_export": 0
                }
            ],
            "Work From Home (No Solar)": [
                {
                    "name": "Heavy WFH User",
                    "description": "Gaming, crypto mining, multiple monitors, constant AC, home gym",
                    "quarterly_consumption": 1365,
                    "peak_percent": 80,  # High consumption during convenient peak hours
                    "shoulder_percent": 15,  # Some usage during work hours but not optimized
                    "off_peak_percent": 5,   # Only basic overnight loads
                    "solar_generation": 0,
                    "self_consumption_percent": 0,
                    "solar_export": 0
                },
                {
                    "name": "Standard WFH",
                    "description": "Regular work setup, moderate AC use, standard appliances",
                    "quarterly_consumption": 1365,
                    "peak_percent": 70,  # Home during peak but not optimized
                    "shoulder_percent": 20,  # Working during 10am-3pm
                    "off_peak_percent": 10,  # Some overnight optimization
                    "solar_generation": 0,
                    "self_consumption_percent": 0,
                    "solar_export": 0
                },
                {
                    "name": "Energy-Smart WFH",
                    "description": "Laptop work, efficient AC use, deliberately schedules appliances for shoulder hours",
                    "quarterly_consumption": 1365,
                    "peak_percent": 60,  # Conscious effort to reduce peak usage
                    "shoulder_percent": 25,  # Maximizes cheap 10am-3pm period
                    "off_peak_percent": 15,  # Some overnight load shifting
                    "solar_generation": 0,
                    "self_consumption_percent": 0,
                    "solar_export": 0
                }
            ],
            "Commuter (With Solar)": [
                {
                    "name": "Solar Export Maximizer",
                    "description": "Minimizes daytime usage to maximize export revenue, poor peak management",
                    "quarterly_consumption": 1365,
                    "peak_percent": 80,  # High evening usage, no load shifting
                    "shoulder_percent": 5,   # Away at work during solar generation
                    "off_peak_percent": 15,  # Limited overnight optimization
                    "solar_generation": 1500,
                    "self_consumption_percent": 12,  # Minimal self-consumption
                    "solar_export": 1320  # 88% export rate - maximum export strategy
                },
                {
                    "name": "Balanced Solar Commuter",
                    "description": "Moderate usage with some weekend solar utilization",
                    "quarterly_consumption": 1365,
                    "peak_percent": 70,  # Some peak reduction through solar offset
                    "shoulder_percent": 8,   # Weekend usage during solar hours
                    "off_peak_percent": 22,  # Good overnight load shifting
                    "solar_generation": 1500,
                    "self_consumption_percent": 20,  # Weekend + some evening self-consumption
                    "solar_export": 1200  # 80% export rate
                },
                {
                    "name": "Smart Solar Commuter",
                    "description": "Maximum load shifting to off-peak while maintaining good solar export",
                    "quarterly_consumption": 1365,
                    "peak_percent": 60,  # Smart peak reduction
                    "shoulder_percent": 10,  # Weekend solar utilization
                    "off_peak_percent": 30,  # Aggressive off-peak shifting (near maximum possible)
                    "solar_generation": 1500,
                    "self_consumption_percent": 25,  # Balanced weekend usage
                    "solar_export": 1125  # 75% export rate
                }
            ],
            "Work From Home (With Solar)": [
                {
                    "name": "High-Consumption WFH Solar",
                    "description": "Heavy energy user despite solar - gaming, mining, inefficient appliances",
                    "quarterly_consumption": 1365,
                    "peak_percent": 75,  # High peak usage despite solar
                    "shoulder_percent": 20,  # Some solar utilization but not optimized
                    "off_peak_percent": 5,   # No load shifting
                    "solar_generation": 1500,
                    "self_consumption_percent": 35,  # Moderate self-consumption due to high usage
                    "solar_export": 975   # 65% export rate
                },
                {
                    "name": "Standard WFH Solar",
                    "description": "Regular work setup with good solar utilization during work hours",
                    "quarterly_consumption": 1365,
                    "peak_percent": 65,  # Reduced by solar self-consumption
                    "shoulder_percent": 25,  # Good usage during solar generation
                    "off_peak_percent": 10,  # Limited overnight optimization
                    "solar_generation": 1500,
                    "self_consumption_percent": 45,  # Good daytime consumption
                    "solar_export": 825   # 55% export rate
                },
                {
                    "name": "Solar-Optimized WFH",
                    "description": "Smart energy management: appliances timed for solar hours, maximum self-consumption",
                    "quarterly_consumption": 1365,
                    "peak_percent": 55,  # Minimized through solar + smart timing
                    "shoulder_percent": 35,  # Maximum utilization of solar generation period
                    "off_peak_percent": 10,  # Strategic overnight usage
                    "solar_generation": 1500,
                    "self_consumption_percent": 55,  # Excellent solar utilization
                    "solar_export": 675   # 45% export rate - prioritizes self-consumption
                }
            ]
        }
    
    def should_disqualify_plan(self, plan_data: Dict) -> bool:
        """Check if plan should be disqualified (matching JS logic)"""
        # Check for demand charges
        if self.has_demand_charge(plan_data):
            return True
        
        # Must have valid peak and off-peak rates
        peak_rate = plan_data.get('peak_cost')
        off_peak_rate = plan_data.get('off_peak_cost')
        
        if not peak_rate or not off_peak_rate or peak_rate <= 0 or off_peak_rate <= 0:
            return True
        
        # Shoulder rate can be null/zero for legitimate 2-rate TOU plans
        shoulder_rate = plan_data.get('shoulder_cost')
        if shoulder_rate is not None and shoulder_rate <= 0:
            # Check if this plan has shoulder period defined but zero rate
            detailed_blocks = plan_data.get('detailed_time_blocks', [])
            has_shoulder_block = any(
                block.get('time_of_use_period') == 'S' or 
                (block.get('name', '').lower().find('shoulder') != -1)
                for block in detailed_blocks
            )
            if has_shoulder_block:
                return True  # Has shoulder period but zero rate - suspicious
        
        return False
    
    def has_demand_charge(self, plan_data: Dict) -> bool:
        """Check if plan has demand charges (matching JS logic)"""
        try:
            raw_plan_data = plan_data.get('raw_plan_data_complete', {}).get('main_api_response', {}).get('planData', {})
            if not raw_plan_data or not raw_plan_data.get('contract'):
                return False
            
            # Check each contract for demand charges
            for contract in raw_plan_data.get('contract', []):
                if contract.get('tariffPeriod'):
                    for tariff_period in contract.get('tariffPeriod', []):
                        if tariff_period.get('demandCharge') and len(tariff_period.get('demandCharge', [])) > 0:
                            return True
            
            return False
        except:
            return False  # If we can't check, don't exclude the plan
    
    def calculate_plan_cost(self, plan_data: Dict, usage_pattern: Dict) -> Optional[Dict]:
        """Calculate plan cost using bill-accurate formula (matching JS calculator)"""
        try:
            # Extract usage pattern values
            quarterly_consumption = usage_pattern['quarterly_consumption']
            peak_percent = usage_pattern['peak_percent']
            shoulder_percent = usage_pattern['shoulder_percent']
            off_peak_percent = usage_pattern['off_peak_percent']
            solar_export = usage_pattern['solar_export']
            
            # Validate inputs
            if not self.validate_inputs(usage_pattern):
                return None
            
            # Step 1: Calculate Fixed Supply Charge
            supply_charge = self.calculate_supply_charge(plan_data.get('daily_supply_charge', 0))
            
            # Step 1.5: Calculate Membership Fee
            membership_fee = self.calculate_membership_fee(plan_data)
            
            # Step 2: Net Grid Consumption (already net after solar self-consumption)
            net_grid_consumption = quarterly_consumption
            
            # Step 3: Calculate Usage Charge
            usage_charge = self.calculate_usage_charge(
                plan_data, net_grid_consumption, peak_percent, shoulder_percent, off_peak_percent
            )
            
            # Step 4: Calculate Solar Export Credit
            solar_credit = self.calculate_solar_credit(plan_data, solar_export)
            
            # Step 5: Calculate Final Bill
            final_bill = supply_charge + usage_charge + membership_fee - solar_credit
            
            return {
                'total_cost': max(0, final_bill),
                'breakdown': {
                    'supply_charge': supply_charge,
                    'usage_charge': usage_charge,
                    'membership_fee': membership_fee,
                    'solar_credit': solar_credit,
                    'net_grid_consumption': net_grid_consumption,
                    'solar_exported': solar_export
                },
                'monthly_cost': max(0, final_bill) / 3,
                'annual_cost': max(0, final_bill) * 4,
                'plan_data': plan_data
            }
            
        except Exception as e:
            print(f"Error calculating cost for plan {plan_data.get('plan_id', 'Unknown')}: {e}")
            return None
    
    def calculate_supply_charge(self, daily_supply_rate: float) -> float:
        """Calculate fixed supply charge for 91-day quarter"""
        return (daily_supply_rate * 91) / 100  # Convert cents to dollars
    
    def calculate_membership_fee(self, plan_data: Dict) -> float:
        """Calculate membership fee for quarter"""
        if plan_data.get('membership_fee_quarterly'):
            return plan_data['membership_fee_quarterly']
        
        # Check raw fee data
        fees = plan_data.get('fees', {})
        if fees.get('membership_fee'):
            membership_fee = fees['membership_fee']
            if membership_fee.get('feeTerm') == 'A' and membership_fee.get('amount'):
                return membership_fee['amount'] / 4  # Convert annual to quarterly
        
        return 0
    
    def calculate_usage_charge(self, plan_data: Dict, net_grid_consumption: float, 
                             peak_percent: float, shoulder_percent: float, off_peak_percent: float) -> float:
        """Calculate usage charge based on TOU rates"""
        peak_consumption = net_grid_consumption * (peak_percent / 100)
        shoulder_consumption = net_grid_consumption * (shoulder_percent / 100)
        off_peak_consumption = net_grid_consumption * (off_peak_percent / 100)
        
        total_usage_charge = 0
        
        # Peak rate
        if plan_data.get('peak_cost') and peak_consumption > 0:
            total_usage_charge += (peak_consumption * plan_data['peak_cost']) / 100
        
        # Shoulder rate (may be null for some plans)
        if plan_data.get('shoulder_cost') and shoulder_consumption > 0:
            total_usage_charge += (shoulder_consumption * plan_data['shoulder_cost']) / 100
        
        # Off-peak rate
        if plan_data.get('off_peak_cost') and off_peak_consumption > 0:
            total_usage_charge += (off_peak_consumption * plan_data['off_peak_cost']) / 100
        
        return total_usage_charge
    
    def calculate_solar_credit(self, plan_data: Dict, solar_exported: float) -> float:
        """Calculate solar export credit"""
        if solar_exported <= 0:
            return 0
        
        # Get solar FiT rate
        fit_rate = plan_data.get('solar_feed_in_rate_r', 0)
        
        if not fit_rate:
            return 0
        
        return (solar_exported * fit_rate) / 100  # Convert cents to dollars
    
    def validate_inputs(self, usage_pattern: Dict) -> bool:
        """Validate input parameters"""
        quarterly_consumption = usage_pattern.get('quarterly_consumption', 0)
        peak_percent = usage_pattern.get('peak_percent', 0)
        shoulder_percent = usage_pattern.get('shoulder_percent', 0)
        off_peak_percent = usage_pattern.get('off_peak_percent', 0)
        solar_export = usage_pattern.get('solar_export', 0)
        
        # Check required fields
        if quarterly_consumption <= 0:
            return False
        if peak_percent < 0 or shoulder_percent < 0 or off_peak_percent < 0:
            return False
        if solar_export < 0:
            return False
        
        # Check percentages add up to 100%
        total_percent = peak_percent + shoulder_percent + off_peak_percent
        if abs(total_percent - 100) > 0.1:
            return False
        
        return True
    
    def calculate_and_rank_plans(self, usage_pattern: Dict) -> List[Dict]:
        """Calculate costs for all plans and rank them"""
        calculations = []
        
        for plan in self.filtered_plans:
            if self.should_disqualify_plan(plan):
                continue
                
            calculation = self.calculate_plan_cost(plan, usage_pattern)
            if calculation:
                calculations.append(calculation)
        
        # Sort by total cost (cheapest first)
        return sorted(calculations, key=lambda x: x['total_cost'])
    
    def generate_markdown_report(self) -> str:
        """Generate user-friendly markdown report with tables"""
        report = []
        
        # Header
        report.append("# 🔌 Best Energy Plans for Your Home")
        report.append("*Find the cheapest electricity plan based on how you actually use energy*")
        report.append("")
        report.append("---")
        report.append("")
        
        # Quick guide
        report.append("## 🏠 Which Category Are You?")
        report.append("")
        report.append("**Choose your situation:**")
        report.append("- 🚗 **Commuter**: You work away from home (9am-5pm)")  
        report.append("- 🏡 **Work From Home**: You're home most days")
        report.append("- ☀️ **With Solar**: You have solar panels")
        report.append("- 🔌 **No Solar**: You don't have solar panels")
        report.append("")
        report.append("---")
        report.append("")
        
        # Persona analysis with tables
        persona_variations = self.get_persona_variations()
        
        # Group personas for better organization
        persona_order = [
            ("🚗 Commuter (No Solar)", "commuter_no_solar"),
            ("🏡 Work From Home (No Solar)", "wfh_no_solar"),  
            ("🚗☀️ Commuter (With Solar)", "commuter_solar"),
            ("🏡☀️ Work From Home (With Solar)", "wfh_solar")
        ]
        
        for display_name, persona_key in persona_order:
            # Map to actual persona names
            actual_persona_name = {
                "commuter_no_solar": "Commuter (No Solar)",
                "wfh_no_solar": "Work From Home (No Solar)",
                "commuter_solar": "Commuter (With Solar)", 
                "wfh_solar": "Work From Home (With Solar)"
            }[persona_key]
            
            variations = persona_variations[actual_persona_name]
            
            report.append(f"## {display_name}")
            report.append("")
            
            # Add usage pattern explanation
            if "Commuter" in actual_persona_name:
                report.append("*You're away from home during the day (9am-5pm) for work*")
            else:
                report.append("*You work from home or are home most of the day*")
            report.append("")
            
            # Create comparison table
            report.append("### 💡 Choose Your Usage Level:")
            report.append("")
            
            # Table header
            report.append("| Your Usage Style | Peak Usage* | Best Plan | Quarterly Cost | Annual Cost |")
            report.append("|------------------|-------------|-----------|----------------|-------------|")
            
            for i, variation in enumerate(variations):
                # Calculate costs
                ranked_plans = self.calculate_and_rank_plans(variation)
                
                if ranked_plans:
                    best_plan = ranked_plans[0]
                    plan_data = best_plan['plan_data']
                    
                    # Simplify usage style names
                    usage_style = variation['name'].replace('Commuter', '').replace('WFH', '').strip()
                    
                    report.append(f"| **{usage_style}** | {variation['peak_percent']}% | {plan_data['retailer_name']} | ${best_plan['total_cost']:.0f} | ${best_plan['annual_cost']:.0f} |")
            
            report.append("")
            report.append("*Peak Usage = How much electricity you use during expensive hours (6am-10am & 3pm-1am)*")
            report.append("")
            
            # Detailed plan tables for each variation
            for i, variation in enumerate(variations):
                ranked_plans = self.calculate_and_rank_plans(variation)
                
                if ranked_plans:
                    usage_style = variation['name'].replace('Commuter', '').replace('WFH', '').strip()
                    report.append(f"#### {usage_style}")
                    report.append(f"*{variation['description']}*")
                    report.append("")
                    
                    # Usage pattern summary
                    report.append("**Your Usage Pattern:**")
                    if variation['solar_export'] > 0:
                        report.append(f"- 🏠 Total Use: {variation['quarterly_consumption']} kWh/quarter")
                        report.append(f"- ⚡ Peak: {variation['peak_percent']}% | Shoulder: {variation['shoulder_percent']}% | Off-Peak: {variation['off_peak_percent']}%") 
                        report.append(f"- ☀️ Solar Export: {variation['solar_export']} kWh/quarter")
                    else:
                        report.append(f"- 🏠 Total Use: {variation['quarterly_consumption']} kWh/quarter")
                        report.append(f"- ⚡ Peak: {variation['peak_percent']}% | Shoulder: {variation['shoulder_percent']}% | Off-Peak: {variation['off_peak_percent']}%")
                    report.append("")
                    
                    # Top 3 plans table
                    report.append("**🏆 Top 3 Cheapest Plans:**")
                    report.append("")
                    
                    # Table header with solar info if applicable
                    if variation['solar_export'] > 0:
                        report.append("| Rank | Provider & Plan | Quarterly | Annual | Peak Rate | Off-Peak Rate | Solar FiT | Why It's Good |")
                        report.append("|------|-----------------|-----------|--------|-----------|---------------|-----------|---------------|")
                    else:
                        report.append("| Rank | Provider & Plan | Quarterly | Annual | Peak Rate | Off-Peak Rate | Why It's Good |")
                        report.append("|------|-----------------|-----------|--------|-----------|---------------|---------------|")
                    
                    for j, plan in enumerate(ranked_plans[:3]):
                        rank = j + 1
                        plan_data = plan['plan_data']
                        
                        # Generate simple recommendation
                        recommendation = self.generate_simple_recommendation(plan_data, variation, rank)
                        
                        if variation['solar_export'] > 0:
                            fit_rate = plan_data.get('solar_feed_in_rate_r', 0)
                            report.append(f"| {rank} | **{plan_data['retailer_name']}**<br>{plan_data['plan_name']} | ${plan['total_cost']:.0f} | ${plan['annual_cost']:.0f} | {plan_data.get('peak_cost', 0):.1f}¢ | {plan_data.get('off_peak_cost', 0):.1f}¢ | {fit_rate:.1f}¢ | {recommendation} |")
                        else:
                            report.append(f"| {rank} | **{plan_data['retailer_name']}**<br>{plan_data['plan_name']} | ${plan['total_cost']:.0f} | ${plan['annual_cost']:.0f} | {plan_data.get('peak_cost', 0):.1f}¢ | {plan_data.get('off_peak_cost', 0):.1f}¢ | {recommendation} |")
                    
                    report.append("")
                    
                    # Savings highlight
                    if len(ranked_plans) > 1:
                        best = ranked_plans[0]
                        second = ranked_plans[1]
                        savings = (second['total_cost'] - best['total_cost']) * 4
                        report.append(f"💰 **Choose #{1} to save ${savings:.0f}/year vs #{2}**")
                        report.append("")
                    
                    report.append("---")
                    report.append("")
        
        # Simple footer
        report.append("## ℹ️ How We Calculated This")
        report.append("- ✅ Only current plans (from June 2025)")
        report.append("- ✅ Excluded restricted plans")
        report.append("- ✅ Excluded EV-only plans (need electric car)")  
        report.append("- ✅ Based on 1,365 kWh quarterly usage")
        report.append("- ✅ All prices include GST")
        report.append("- ✅ Solar calculations include self-use and export credits")
        report.append("")
        report.append("**Time Periods:**")
        report.append("- **Peak** (expensive): 6am-10am & 3pm-1am daily")
        report.append("- **Shoulder** (medium): 10am-3pm daily") 
        report.append("- **Off-Peak** (cheap): 1am-6am daily")
        report.append("")
        
        return "\n".join(report)
    
    def generate_simple_recommendation(self, plan_data: Dict, variation: Dict, rank: int) -> str:
        """Generate simple recommendation for regular users"""
        retailer = plan_data['retailer_name']
        peak_rate = plan_data.get('peak_cost', 0)
        off_peak_rate = plan_data.get('off_peak_cost', 0)
        supply_charge = plan_data.get('daily_supply_charge', 0)
        fit_rate = plan_data.get('solar_feed_in_rate_r', 0)
        
        if rank == 1:
            if variation['solar_export'] > 0:
                if fit_rate > 8:
                    return "🏆 Best value + excellent solar credits"
                else:
                    return "🏆 Best overall value for your usage"
            else:
                if off_peak_rate < 20:
                    return "🏆 Best value + great off-peak rates"
                else:
                    return "🏆 Best overall value for your usage"
        elif rank == 2:
            return "🥈 Good backup option"
        else:
            return "🥉 Third choice"
    
    def run_analysis(self) -> str:
        """Run complete analysis and return markdown report"""
        return self.generate_markdown_report()

def main():
    """Main function to run the analysis"""
    analyzer = EnergyPlanAnalyzer('/home/krkr/energy/docs/all_energy_plans.json')
    markdown_report = analyzer.run_analysis()
    
    # Save report to file
    with open('/home/krkr/energy/energy_plan_analysis_report.md', 'w') as f:
        f.write(markdown_report)
    
    print("Analysis complete! Report saved to energy_plan_analysis_report.md")
    print("\nReport preview:")
    print("=" * 80)
    print(markdown_report[:2000] + "...")

if __name__ == "__main__":
    main()