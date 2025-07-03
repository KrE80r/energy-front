#!/usr/bin/env python3
import json
import re
from collections import defaultdict, Counter

def extract_all_restrictions():
    """Extract and analyze all eligibility restrictions from the energy plans JSON"""
    
    # Read the JSON file
    with open('/home/krkr/energy/docs/all_energy_plans.json', 'r') as f:
        data = json.load(f)
    
    # Extract all plans and their restrictions
    plans_with_restrictions = []
    all_restrictions = []
    
    def extract_restrictions_from_plan(plan_data):
        """Recursively find all eligibilityRestriction arrays in plan data"""
        restrictions = []
        
        def find_restrictions(obj, path=''):
            if isinstance(obj, dict):
                if 'eligibilityRestriction' in obj:
                    restrictions.extend(obj['eligibilityRestriction'])
                for key, value in obj.items():
                    find_restrictions(value, path + '.' + key if path else key)
            elif isinstance(obj, list):
                for i, item in enumerate(obj):
                    find_restrictions(item, path + f'[{i}]' if path else f'[{i}]')
        
        find_restrictions(plan_data)
        return restrictions
    
    # Process all plans
    for plan_type, plan_list in data['plans'].items():
        for plan in plan_list:
            plan_id = plan.get('plan_id', 'Unknown')
            plan_name = plan.get('plan_name', 'Unknown')
            retailer = plan.get('retailer_name', 'Unknown')
            
            # Check if plan has restrictions in raw_plan_data
            raw_plan_data = plan.get('raw_plan_data', {})
            has_restrictions = raw_plan_data.get('eligibility_restrictions', False)
            
            if has_restrictions:
                # Look for restrictions in raw_plan_data_complete
                raw_data = plan.get('raw_plan_data_complete', {})
                
                if raw_data:
                    restrictions = extract_restrictions_from_plan(raw_data)
                    
                    if restrictions:
                        plan_info = {
                            'plan_id': plan_id,
                            'plan_name': plan_name,
                            'retailer': retailer,
                            'restrictions': restrictions
                        }
                        plans_with_restrictions.append(plan_info)
                        
                        # Add restriction context
                        for restriction in restrictions:
                            restriction_with_context = restriction.copy()
                            restriction_with_context['plan_id'] = plan_id
                            restriction_with_context['plan_name'] = plan_name
                            restriction_with_context['retailer'] = retailer
                            all_restrictions.append(restriction_with_context)
    
    return plans_with_restrictions, all_restrictions

def analyze_restrictions(all_restrictions):
    """Analyze and categorize all restrictions"""
    
    # Group by restriction type
    types = Counter()
    restriction_details = defaultdict(list)
    
    for restriction in all_restrictions:
        rtype = restriction.get('type', 'Unknown')
        description = restriction.get('description', '')
        information = restriction.get('information', '')
        
        types[rtype] += 1
        restriction_details[rtype].append({
            'description': description,
            'information': information,
            'plan_id': restriction.get('plan_id'),
            'plan_name': restriction.get('plan_name'),
            'retailer': restriction.get('retailer'),
            'full_restriction': restriction
        })
    
    return types, restriction_details

def print_analysis(plans_with_restrictions, all_restrictions):
    """Print comprehensive analysis of all restrictions"""
    
    types, restriction_details = analyze_restrictions(all_restrictions)
    
    print("ELIGIBILITY RESTRICTIONS ANALYSIS")
    print("="*80)
    print(f"Total plans with restrictions: {len(plans_with_restrictions)}")
    print(f"Total individual restrictions found: {len(all_restrictions)}")
    print()
    
    print("RESTRICTION TYPES SUMMARY:")
    print("-" * 40)
    for rtype, count in types.most_common():
        print(f"{rtype}: {count} occurrences")
    print()
    
    print("DETAILED RESTRICTION ANALYSIS BY TYPE:")
    print("="*80)
    
    for rtype in sorted(types.keys()):
        print(f"\nRESTRICTION TYPE: {rtype}")
        print(f"Total occurrences: {types[rtype]}")
        print("-" * 60)
        
        # Get unique descriptions for this type
        unique_descriptions = {}
        for r in restriction_details[rtype]:
            desc = r['description']
            if desc not in unique_descriptions:
                unique_descriptions[desc] = {
                    'count': 0, 
                    'information_fields': set(),
                    'plans': set()
                }
            unique_descriptions[desc]['count'] += 1
            if r['information']:
                unique_descriptions[desc]['information_fields'].add(r['information'])
            unique_descriptions[desc]['plans'].add(f"{r['retailer']} - {r['plan_name']}")
        
        for i, (desc, details) in enumerate(sorted(unique_descriptions.items()), 1):
            print(f"{i}. DESCRIPTION: {desc}")
            print(f"   Count: {details['count']}")
            if details['information_fields']:
                print(f"   Information fields: {', '.join(sorted(details['information_fields']))}")
            print(f"   Example plans: {'; '.join(sorted(list(details['plans']))[:3])}")
            if len(details['plans']) > 3:
                print(f"   ... and {len(details['plans']) - 3} more plans")
            print()
    
    print("="*80)
    print("RESTRICTION CATEGORIZATION:")
    print("="*80)
    
    categories = {
        'SP': 'Solar/Technical Requirements',
        'SC': 'Seniors Card Requirements', 
        'OC': 'Other Customer Requirements',
        'SM': 'Smart Meter Requirements'
    }
    
    for rtype, category in categories.items():
        if rtype in types:
            print(f"{rtype} ({category}): {types[rtype]} restrictions")
            # Show unique restriction texts
            unique_texts = set()
            for r in restriction_details[rtype]:
                unique_texts.add(r['description'])
            for text in sorted(unique_texts):
                print(f"   • {text}")
            print()

if __name__ == "__main__":
    plans_with_restrictions, all_restrictions = extract_all_restrictions()
    print_analysis(plans_with_restrictions, all_restrictions)