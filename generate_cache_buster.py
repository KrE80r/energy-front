#!/usr/bin/env python3
"""
Generate cache-buster timestamps for static assets based on Git commit history.
This ensures browsers reload files when they change.
"""

import json
import subprocess
import os
from pathlib import Path

def get_file_git_timestamp(file_path):
    """Get the timestamp of the last commit that modified a file."""
    try:
        result = subprocess.run(
            ['git', 'log', '-1', '--format=%ct', '--', file_path],
            capture_output=True,
            text=True,
            cwd=os.path.dirname(os.path.abspath(__file__))
        )
        if result.returncode == 0 and result.stdout.strip():
            return int(result.stdout.strip())
        else:
            # Fallback to file modification time if git fails
            return int(os.path.getmtime(file_path))
    except Exception:
        # Final fallback to current timestamp
        import time
        return int(time.time())

def generate_cache_busters():
    """Generate cache-buster timestamps for all static assets."""
    
    # Define assets to cache-bust
    assets = [
        'docs/css/style.css',
        'docs/js/app.js',
        'docs/js/calculator.js',
        'docs/js/personas.js',
        'docs/js/ui.js',
        'docs/predicted_energy_plans.json'
    ]
    
    cache_busters = {}
    
    for asset in assets:
        if os.path.exists(asset):
            timestamp = get_file_git_timestamp(asset)
            # Create a relative path key (removing 'docs/' prefix for client-side use)
            key = asset.replace('docs/', '') if asset.startswith('docs/') else asset
            cache_busters[key] = timestamp
            print(f"Generated cache-buster for {asset}: {timestamp}")
        else:
            print(f"Warning: Asset {asset} not found")
    
    # Write cache-busters to JSON file
    output_path = 'docs/cache-busters.json'
    with open(output_path, 'w') as f:
        json.dump(cache_busters, f, indent=2)
    
    print(f"Cache-busters written to {output_path}")
    return cache_busters

if __name__ == '__main__':
    generate_cache_busters()