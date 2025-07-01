#!/usr/bin/env python3
"""
Script to merge all plans from predicted_energy_plans.json with expiring plans 
from all_energy_plans.json (2026-06-30), avoiding duplicates based on planId.
"""
import json
import sys
from pathlib import Path

def load_json_file(file_path):
    """Load and parse JSON file."""
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: File {file_path} not found")
        return None
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in {file_path}: {e}")
        return None

def extract_expiring_plans(data, expiry_date="2026-06-30"):
    """Extract plans that expire on the given date."""
    expiring_plans = []
    
    if not data or 'plans' not in data:
        return expiring_plans
    
    # Check TOU plans
    if 'TOU' in data['plans']:
        for plan in data['plans']['TOU']:
            # Check in raw_plan_data_complete for expiry date
            if 'raw_plan_data_complete' in plan:
                raw_data = plan['raw_plan_data_complete']
                
                # Extract expiry date from the nested structure
                expiry = None
                if (raw_data and 'detailed_api_response' in raw_data and 
                    raw_data['detailed_api_response'] and 
                    'data' in raw_data['detailed_api_response'] and
                    raw_data['detailed_api_response']['data']):
                    
                    data_obj = raw_data['detailed_api_response']['data']
                    
                    # Check directly in data
                    if 'expiryDate' in data_obj:
                        expiry = data_obj['expiryDate']
                    # Check in planData
                    elif ('planData' in data_obj and 
                          data_obj['planData'] and 
                          'expiryDate' in data_obj['planData']):
                        expiry = data_obj['planData']['expiryDate']
                
                # Add plan if it matches target date
                if expiry == expiry_date:
                    expiring_plans.append(plan)
    
    return expiring_plans

def get_all_plans(data):
    """Get all plans from a data structure."""
    all_plans = []
    
    if not data or 'plans' not in data:
        return all_plans
    
    # Get all TOU plans
    if 'TOU' in data['plans']:
        all_plans.extend(data['plans']['TOU'])
    
    return all_plans

def merge_plans_avoiding_duplicates(base_plans, new_plans):
    """Merge two lists of plans, avoiding duplicates based on plan_id."""
    merged_plans = []
    seen_plan_ids = set()
    
    # Add all base plans first
    for plan in base_plans:
        plan_id = plan.get('plan_id')
        if plan_id and plan_id not in seen_plan_ids:
            merged_plans.append(plan)
            seen_plan_ids.add(plan_id)
    
    # Add new plans (avoiding duplicates)
    duplicates_found = []
    new_plans_added = []
    
    for plan in new_plans:
        plan_id = plan.get('plan_id')
        if plan_id:
            if plan_id not in seen_plan_ids:
                merged_plans.append(plan)
                seen_plan_ids.add(plan_id)
                new_plans_added.append(plan_id)
            else:
                duplicates_found.append(plan_id)
    
    return merged_plans, duplicates_found, new_plans_added

def main():
    # File paths
    all_plans_file = Path("all_energy_plans.json")
    predicted_plans_file = Path("docs/predicted_energy_plans.json")
    output_file = Path("enhanced_predicted_energy_plans.json")
    
    # Load JSON files
    print("Loading energy plan files...")
    all_plans_data = load_json_file(all_plans_file)
    predicted_plans_data = load_json_file(predicted_plans_file)
    
    if not all_plans_data:
        print("Error: Could not load all_energy_plans.json")
        sys.exit(1)
    
    if not predicted_plans_data:
        print("Error: Could not load predicted_energy_plans.json")
        sys.exit(1)
    
    # Extract expiring plans from all_energy_plans.json
    expiring_plans = extract_expiring_plans(all_plans_data)
    print(f"Found {len(expiring_plans)} plans expiring on 2026-06-30 in all_energy_plans.json")
    
    # Get all plans from predicted_energy_plans.json
    predicted_plans = get_all_plans(predicted_plans_data)
    print(f"Found {len(predicted_plans)} plans in predicted_energy_plans.json")
    
    # Merge: start with all predicted plans, add expiring plans if not duplicates
    merged_plans, duplicates, new_added = merge_plans_avoiding_duplicates(predicted_plans, expiring_plans)
    
    print(f"Final total: {len(merged_plans)} unique plans")
    print(f"Plans added from expiring: {len(new_added)}")
    if duplicates:
        print(f"Duplicates skipped: {len(duplicates)} - {duplicates}")
    
    # Update metadata
    new_metadata = predicted_plans_data['metadata'].copy()
    new_metadata['total_plans'] = len(merged_plans)
    new_metadata['tou_count'] = len(merged_plans)
    new_metadata['enhancement_info'] = {
        'base_file': 'docs/predicted_energy_plans.json',
        'enhancement_source': 'all_energy_plans.json',
        'added_plans_criteria': 'expiryDate = 2026-06-30',
        'plans_added': len(new_added),
        'duplicates_skipped': len(duplicates),
        'enhancement_date': '2025-06-30'
    }
    
    # Create output structure
    output_data = {
        "metadata": new_metadata,
        "plans": {
            "TOU": merged_plans
        }
    }
    
    # Write merged results
    print(f"Writing enhanced results to {output_file}...")
    with open(output_file, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print("Enhancement completed successfully!")
    
    # Show newly added plan IDs for verification
    if new_added:
        print(f"\nNewly added plan IDs:")
        for plan_id in new_added:
            # Find the plan to show name and retailer
            for plan in merged_plans:
                if plan.get('plan_id') == plan_id:
                    plan_name = plan.get('plan_name', 'Unknown')
                    retailer = plan.get('retailer_name', 'Unknown')
                    print(f"  {plan_id} - {plan_name} ({retailer})")
                    break

if __name__ == "__main__":
    main()