#!/usr/bin/env python3
"""
Monthly Energy Plan Reporter - Main Orchestrator

Runs monthly analysis to detect cheaper energy plans and sends WhatsApp alerts.
Designed to run via cron at 6pm on the 1st of each month.

Usage:
    python main.py [--dry-run] [--verbose] [--chat-id CHAT_ID]
"""

import argparse
import json
import logging
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, Any

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from cost_calculator import get_calculator
from history_manager import get_history_manager
from comparison_engine import get_comparison_engine
from whatsapp_notifier import get_notifier


def setup_logging(verbose: bool = False) -> logging.Logger:
    """Configure logging"""
    level = logging.DEBUG if verbose else logging.INFO

    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('/home/krkr/energy/monthly_reporter/monthly_report.log'),
            logging.StreamHandler(sys.stdout)
        ]
    )

    return logging.getLogger(__name__)


def load_profile_configs() -> Dict[str, Dict[str, Any]]:
    """Load profile configurations"""
    config_file = Path("/home/krkr/energy/data/profile_configs.json")

    try:
        with open(config_file, 'r') as f:
            data = json.load(f)
        return data['profiles']
    except Exception as e:
        logging.error(f"Failed to load profile configs: {e}")
        sys.exit(1)


def run_monthly_report(dry_run: bool = False, chat_id: str = None) -> Dict[str, Any]:
    """
    Execute monthly energy plan analysis and reporting

    Args:
        dry_run: If True, skip WhatsApp notifications
        chat_id: Optional WhatsApp chat ID override

    Returns:
        Report summary dict
    """
    logger = logging.getLogger(__name__)
    logger.info("=" * 80)
    logger.info("STARTING MONTHLY ENERGY PLAN REPORT")
    logger.info(f"Timestamp: {datetime.now().isoformat()}")
    logger.info(f"Dry run: {dry_run}")
    logger.info("=" * 80)

    # Load profile configurations
    logger.info("Loading profile configurations...")
    profile_configs = load_profile_configs()
    logger.info(f"Loaded {len(profile_configs)} profiles: {list(profile_configs.keys())}")

    # Initialize components
    comparison_engine = get_comparison_engine()
    notifier = get_notifier(chat_id=chat_id)

    # Run comparison for all profiles
    logger.info("Running monthly comparison...")
    comparison_results = comparison_engine.run_monthly_comparison(
        profile_configs,
        baseline_retailers=["AGL", "Origin Energy"]
    )

    if 'error' in comparison_results:
        logger.error(f"Comparison failed: {comparison_results['error']}")
        return {'status': 'error', 'error': comparison_results['error']}

    # Process results and send alerts
    report_summary = {
        'status': 'success',
        'timestamp': comparison_results['timestamp'],
        'total_plans_analyzed': comparison_results['total_plans_analyzed'],
        'profiles_analyzed': len(comparison_results['profiles']),
        'total_opportunities': 0,
        'alerts_sent': 0,
        'profiles': {}
    }

    for profile_name, profile_results in comparison_results['profiles'].items():
        logger.info(f"\nProcessing profile: {profile_name}")

        opportunities = profile_results['savings_opportunities']
        cheapest_plans = profile_results['cheapest_plans']

        logger.info(f"Found {len(opportunities)} savings opportunities")

        profile_summary = {
            'opportunities_found': len(opportunities),
            'alerts_sent': 0,
            'cheapest_plans': {}
        }

        # Record cheapest plans
        for retailer, plan in cheapest_plans.items():
            if plan:
                profile_summary['cheapest_plans'][retailer] = {
                    'plan_name': plan['plan_name'],
                    'cost': plan['total_cost']
                }

        # Send alerts for opportunities
        if opportunities:
            report_summary['total_opportunities'] += len(opportunities)

            if not dry_run:
                for opportunity in opportunities:
                    success = notifier.send_savings_alert(opportunity)
                    if success:
                        profile_summary['alerts_sent'] += 1
                        report_summary['alerts_sent'] += 1
            else:
                logger.info("DRY RUN: Would send the following alerts:")
                for i, opp in enumerate(opportunities, 1):
                    logger.info(f"\nAlert {i}:")
                    logger.info(notifier.format_savings_alert(opp))

        report_summary['profiles'][profile_name] = profile_summary

    # Final summary
    logger.info("\n" + "=" * 80)
    logger.info("MONTHLY REPORT SUMMARY")
    logger.info("=" * 80)
    logger.info(f"Total plans analyzed: {report_summary['total_plans_analyzed']}")
    logger.info(f"Profiles analyzed: {report_summary['profiles_analyzed']}")
    logger.info(f"Savings opportunities found: {report_summary['total_opportunities']}")
    logger.info(f"WhatsApp alerts sent: {report_summary['alerts_sent']}")

    for profile_name, profile_data in report_summary['profiles'].items():
        logger.info(f"\n{profile_name}:")
        logger.info(f"  Opportunities: {profile_data['opportunities_found']}")
        logger.info(f"  Alerts sent: {profile_data['alerts_sent']}")
        logger.info(f"  Cheapest plans:")
        for retailer, plan_info in profile_data['cheapest_plans'].items():
            logger.info(f"    {retailer}: {plan_info['plan_name']} (${plan_info['cost']:.2f}/qtr)")

    logger.info("=" * 80)

    # Save report to file
    report_file = Path(f"/home/krkr/energy/monthly_reporter/reports/report_{datetime.now().strftime('%Y-%m')}.json")
    report_file.parent.mkdir(parents=True, exist_ok=True)

    with open(report_file, 'w') as f:
        json.dump(report_summary, f, indent=2, default=str)

    logger.info(f"Report saved to: {report_file}")

    return report_summary


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Monthly Energy Plan Reporter - Detect cheaper plans and send WhatsApp alerts"
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help="Run analysis without sending WhatsApp notifications"
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help="Enable verbose logging"
    )
    parser.add_argument(
        '--chat-id',
        type=str,
        help="WhatsApp chat ID to send alerts to (defaults to Canary dev group)"
    )

    args = parser.parse_args()

    # Setup logging
    logger = setup_logging(args.verbose)

    try:
        # Run monthly report
        report = run_monthly_report(dry_run=args.dry_run, chat_id=args.chat_id)

        if report['status'] == 'success':
            logger.info("Monthly report completed successfully")
            sys.exit(0)
        else:
            logger.error("Monthly report failed")
            sys.exit(1)

    except Exception as e:
        logger.exception(f"Unexpected error during monthly report: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
