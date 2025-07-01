#!/usr/bin/env python3
"""
Script to merge energy plans expiring on 2026-06-30 from multiple JSON files,
avoiding duplicates based on planId.
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

def merge_plans_avoiding_duplicates(plans_list1, plans_list2):
    """Merge two lists of plans, avoiding duplicates based on plan_id."""
    merged_plans = []
    seen_plan_ids = set()
    
    # Add plans from first list
    for plan in plans_list1:
        plan_id = plan.get('plan_id')
        if plan_id and plan_id not in seen_plan_ids:
            merged_plans.append(plan)
            seen_plan_ids.add(plan_id)
    
    # Add plans from second list (avoiding duplicates)
    for plan in plans_list2:
        plan_id = plan.get('plan_id')
        if plan_id and plan_id not in seen_plan_ids:
            merged_plans.append(plan)
            seen_plan_ids.add(plan_id)
    
    return merged_plans

def main():
    # File paths
    all_plans_file = Path("all_energy_plans.json")
    predicted_plans_file = Path("docs/predicted_energy_plans.json")
    output_file = Path("merged_expiring_plans_2026-06-30.json")
    
    # Load JSON files
    print("Loading energy plan files...")
    all_plans_data = load_json_file(all_plans_file)
    predicted_plans_data = load_json_file(predicted_plans_file)
    
    if not all_plans_data and not predicted_plans_data:
        print("Error: Could not load any data files")
        sys.exit(1)
    
    # Extract expiring plans
    all_expiring = extract_expiring_plans(all_plans_data) if all_plans_data else []
    predicted_expiring = extract_expiring_plans(predicted_plans_data) if predicted_plans_data else []
    
    print(f"Found {len(all_expiring)} expiring plans in all_energy_plans.json")
    print(f"Found {len(predicted_expiring)} expiring plans in predicted_energy_plans.json")
    
    # Merge avoiding duplicates
    merged_tou_plans = merge_plans_avoiding_duplicates(all_expiring, predicted_expiring)
    
    print(f"Merged total: {len(merged_tou_plans)} unique plans")
    
    # Show duplicate detection summary
    if len(all_expiring) + len(predicted_expiring) > len(merged_tou_plans):
        duplicates_removed = len(all_expiring) + len(predicted_expiring) - len(merged_tou_plans)
        print(f"Duplicates removed: {duplicates_removed}")
    
    # Create output structure
    output_data = {
        "metadata": {
            "source_files": ["all_energy_plans.json", "docs/predicted_energy_plans.json"],
            "filter_criteria": "expiryDate = 2026-06-30",
            "total_plans": len(merged_tou_plans),
            "extraction_date": "2025-06-30",
            "duplicate_detection": "planId field used as unique identifier"
        },
        "plans": {
            "TOU": merged_tou_plans
        }
    }
    
    # Write merged results
    print(f"Writing merged results to {output_file}...")
    with open(output_file, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print("Merge completed successfully!")
    
    # Show plan IDs for verification
    if merged_tou_plans:
        print("\nMerged plan IDs:")
        for plan in merged_tou_plans:
            plan_id = plan.get('plan_id', 'Unknown')
            plan_name = plan.get('plan_name', 'Unknown')
            retailer = plan.get('retailer_name', 'Unknown')
            print(f"  {plan_id} - {plan_name} ({retailer})")

if __name__ == "__main__":
    main()