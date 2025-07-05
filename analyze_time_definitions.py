#!/usr/bin/env python3
"""
Energy Plan Time Definitions Analysis
Analyzes time definitions (Peak, Shoulder, Off-Peak) across all energy plans
"""

import json
from collections import defaultdict, Counter
from datetime import datetime, time

def parse_time_string(time_str):
    """Convert time string like '0600' to a time object"""
    if not time_str or len(time_str) != 4:
        return None
    try:
        hour = int(time_str[:2])
        minute = int(time_str[2:])
        return time(hour, minute)
    except ValueError:
        return None

def format_time_period(start_time, end_time):
    """Format time period for display"""
    if not start_time or not end_time:
        return "Invalid time"
    
    start_str = start_time.strftime("%I:%M %p").lstrip('0').lower()
    end_str = end_time.strftime("%I:%M %p").lstrip('0').lower()
    
    # Handle overnight periods
    if start_time > end_time:
        return f"{start_str} - {end_str} (next day)"
    else:
        return f"{start_str} - {end_str}"

def analyze_time_definitions():
    """Analyze time definitions across all energy plans"""
    
    # Load the energy plans data
    with open('/home/krkr/energy/docs/all_energy_plans.json', 'r') as f:
        data = json.load(f)
    
    plans = data.get('plans', {}).get('TOU', [])
    
    # Storage for time patterns
    time_patterns = {
        'Peak': defaultdict(list),
        'Shoulder': defaultdict(list), 
        'Off-Peak': defaultdict(list)
    }
    
    # Map API codes to readable names
    period_map = {
        'P': 'Peak',
        'S': 'Shoulder',
        'OP': 'Off-Peak'
    }
    
    total_plans = len(plans)
    plans_analyzed = 0
    
    print(f"Analyzing {total_plans} energy plans...")
    
    for plan in plans:
        plan_id = plan.get('plan_id', 'Unknown')
        plan_name = plan.get('plan_name', 'Unknown')
        retailer = plan.get('retailer_name', 'Unknown')
        
        detailed_blocks = plan.get('detailed_time_blocks', [])
        
        if not detailed_blocks:
            continue
            
        plans_analyzed += 1
        
        for block in detailed_blocks:
            period_code = block.get('time_of_use_period', '')
            period_name = period_map.get(period_code, period_code)
            
            if period_name not in time_patterns:
                continue
                
            time_periods = block.get('time_periods', [])
            
            # Collect all time periods for this TOU type
            period_times = []
            for period in time_periods:
                start_time = parse_time_string(period.get('start_time', ''))
                end_time = parse_time_string(period.get('end_time', ''))
                days = period.get('days', '')
                
                if start_time and end_time:
                    period_times.append({
                        'start': start_time,
                        'end': end_time,
                        'days': days
                    })
            
            # Create a signature for this time pattern
            if period_times:
                # Sort by start time to normalize the pattern
                period_times.sort(key=lambda x: (x['start'], x['end']))
                
                # Create a pattern string
                pattern_parts = []
                for pt in period_times:
                    pattern_parts.append(format_time_period(pt['start'], pt['end']))
                
                pattern = " & ".join(pattern_parts)
                
                time_patterns[period_name][pattern].append({
                    'plan_id': plan_id,
                    'plan_name': plan_name,
                    'retailer': retailer
                })
    
    print(f"\nAnalyzed {plans_analyzed} plans with time definitions")
    print("=" * 80)
    
    # Generate summary report
    for period_type in ['Peak', 'Shoulder', 'Off-Peak']:
        print(f"\n{period_type.upper()} HOUR DEFINITIONS:")
        print("-" * 40)
        
        patterns = time_patterns[period_type]
        if not patterns:
            print("No patterns found")
            continue
        
        # Sort patterns by frequency (most common first)
        sorted_patterns = sorted(patterns.items(), key=lambda x: len(x[1]), reverse=True)
        
        for i, (pattern, plan_list) in enumerate(sorted_patterns):
            count = len(plan_list)
            percentage = (count / plans_analyzed) * 100
            
            print(f"{i+1}. {pattern}")
            print(f"   Plans: {count} ({percentage:.1f}%)")
            
            if i == 0:  # Show some examples for the most common pattern
                print(f"   Examples: {', '.join([p['retailer'] for p in plan_list[:3]])}")
            
            print()
    
    # Overall summary
    print("=" * 80)
    print("SUMMARY:")
    print(f"Total plans in dataset: {total_plans}")
    print(f"Plans with time definitions: {plans_analyzed}")
    print(f"Plans without time definitions: {total_plans - plans_analyzed}")
    
    # Find the most common pattern for each period type
    most_common = {}
    for period_type in ['Peak', 'Shoulder', 'Off-Peak']:
        patterns = time_patterns[period_type]
        if patterns:
            most_common_pattern = max(patterns.items(), key=lambda x: len(x[1]))
            most_common[period_type] = {
                'pattern': most_common_pattern[0],
                'count': len(most_common_pattern[1])
            }
    
    print("\nMOST COMMON TIME PATTERNS:")
    for period_type, info in most_common.items():
        print(f"{period_type}: {info['pattern']} ({info['count']} plans)")
    
    return time_patterns, most_common

if __name__ == "__main__":
    analyze_time_definitions()