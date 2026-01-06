# Monthly Energy Plan Reporter

Automated system for detecting cheaper energy plans and sending WhatsApp alerts on the 1st of each month at 6pm.

**🎯 INTEGRATED WITH WA_BOT** - No cron job needed, uses existing scheduler.

## Features

- **Automated Plan Analysis**: Analyzes all available energy plans monthly
- **Profile-Based Comparison**: Supports multiple usage profiles (Commuter with/without Solar)
- **Baseline Tracking**: Compares against AGL and Origin Energy cheapest plans
- **Savings Detection**: Identifies when new cheaper plans become available
- **WhatsApp Alerts**: Sends detailed alerts to configured WhatsApp group
- **Historical Tracking**: Maintains JSON-based history for trend analysis
- **Bill-Accurate Calculations**: Matches real electricity bill costs (90%+ accuracy)

## Architecture

```
monthly_reporter/
├── __init__.py              # Package initialization
├── main.py                  # Main orchestrator (entry point)
├── cost_calculator.py       # Bill-accurate cost calculation engine
├── history_manager.py       # JSON-based historical data storage
├── comparison_engine.py     # Plan comparison and savings detection
├── whatsapp_notifier.py     # WhatsApp alert formatting and sending
└── README.md                # This file

/home/krkr/energy/
├── run_monthly_report.sh    # Cron wrapper script
├── data/
│   ├── profile_configs.json # Profile definitions
│   └── plan_history.json    # Monthly historical snapshots
└── all_energy_plans.json    # Latest plan data
```

## Profile Configurations

Defined in `/home/krkr/energy/data/profile_configs.json`:

### Commuter with Solar
- **Consumption**: 1365 kWh/quarter (net grid)
- **Solar Export**: 1200 kWh/quarter
- **TOU Split**: 70% peak, 8% shoulder, 22% off-peak
- **Rationale**: Away during midday, exports 80% of solar, good load shifting

### Commuter without Solar
- **Consumption**: 1365 kWh/quarter
- **Solar Export**: 0 kWh
- **TOU Split**: 75% peak, 8% shoulder, 17% off-peak
- **Rationale**: Standard commuter with hot water on timer

## Cost Calculation

Matches frontend calculator.js logic exactly:

1. **Supply Charge**: `daily_rate × 91 days / 100`
2. **Usage Charge**: `(peak_kwh × peak_rate + shoulder_kwh × shoulder_rate + offpeak_kwh × offpeak_rate) / 100`
3. **Membership Fee**: `annual_fee / 4` (if applicable)
4. **Solar Credit**: `solar_export_kwh × fit_rate / 100`
5. **Base Bill**: `supply + usage + membership - solar_credit`
6. **Final Bill**: `base_bill × (1 - guaranteed_discount_percent / 100)`

## Filtering & Exclusions

Applied filters (matching frontend):
- ✅ Effective date >= current date
- ❌ Exclude 32 plans with SC/OC restrictions (seniors, memberships)
- ❌ Exclude plans with demand charges
- ❌ Exclude plans with invalid rates (zero/null peak or off-peak)

## Alert Triggers

Alerts are sent ONLY when:
1. Current month's cheapest plan for a retailer < previous month's cheapest
2. It's either a NEW plan or an existing plan with a price drop
3. The opportunity is worth reporting (any savings amount)

## Installation

### ✅ Already Integrated!

This system is integrated into wa_bot's existing scheduler. No manual setup required!

**What happens automatically:**
1. wa_bot loads `energy_plan_service` on startup
2. Scheduler registers task to run daily at 6pm
3. Task checks if day == 1 (first of month)
4. If yes, runs energy plan analysis
5. Sends WhatsApp alerts if savings found

**To verify it's running:**

```bash
# Check wa_bot logs
grep "energy_plan" /home/krkr/wa_bot/logs/bot.log

# Should see:
# "Registered monthly energy plan checks (1st of month at 6pm) for dev chats"
```

### Manual Testing (Optional)

```bash
# Test calculation engine directly
cd /home/krkr/energy/monthly_reporter
python3 main.py --dry-run --verbose

# Or trigger from wa_bot context
python3 -c "
import sys
sys.path.insert(0, '/home/krkr/wa_bot')
from services.scheduled_services import scheduled_services
from config import DEV_CHAT_IDS

# Run immediately (test mode)
scheduled_services.check_energy_plans_centralized(DEV_CHAT_IDS)
"
```

## Usage

### Manual Execution

```bash
# Full run with alerts
python3 /home/krkr/energy/monthly_reporter/main.py

# Dry run (test without sending)
python3 /home/krkr/energy/monthly_reporter/main.py --dry-run --verbose

# Custom chat ID
python3 /home/krkr/energy/monthly_reporter/main.py --chat-id "YOUR_CHAT_ID@g.us"
```

### Via Cron Wrapper

```bash
# Test the wrapper script
/home/krkr/energy/run_monthly_report.sh
```

### View Logs

```bash
# Main application log
tail -f /home/krkr/energy/monthly_reporter/monthly_report.log

# Cron execution log
tail -f /home/krkr/energy/monthly_reporter/cron.log

# Error log
tail -f /home/krkr/energy/monthly_reporter/cron_errors.log
```

## WhatsApp Alert Format

```
🔔 🆕 NEW PLAN: Cheaper Energy Plan Alert!

**Profile:** Commuter With Solar
**Retailer:** AGL

**New Cheapest Plan:** Time of Use Saver
**Quarterly Cost:** $493.66

**Savings:**
• vs Previous: $25.50/quarter
• Annual Savings: $102.00/year

**Cost Breakdown:**
• Supply: 109.20 ($1.20/day)
• Usage: $543.58
• Solar Credit: -$72.00
• Membership: $0.00
• Discount: 15.0% guaranteed

**Rates (¢/kWh):**
• Peak: 45.50
• Shoulder: 35.20
• Off-Peak: 25.30
• Solar FiT: 6.00

**Previous Best:** Time of Use Standard ($519.16/qtr)
```

## Historical Data

Stored in `/home/krkr/energy/data/plan_history.json`:

```json
{
  "2025-11": {
    "commuter_solar": {
      "agl_cheapest": {
        "plan_id": "AGL123456",
        "plan_name": "Time of Use Saver",
        "total_cost": 493.66,
        "saved_at": "2025-11-01T18:00:00"
      },
      "origin_energy_cheapest": {
        "plan_id": "ORI789012",
        "plan_name": "Solar Boost",
        "total_cost": 512.30,
        "saved_at": "2025-11-01T18:00:00"
      }
    }
  }
}
```

## Troubleshooting

### No alerts received
1. Check dry-run works: `python3 main.py --dry-run`
2. Verify WhatsApp bot is running: Check wa_bot status
3. Check logs for errors: `tail -f monthly_report.log`

### Incorrect costs
1. Compare against frontend calculator at `/home/krkr/energy/docs/index.html`
2. Enable verbose logging: `python3 main.py --verbose --dry-run`
3. Verify profile configs: `cat /home/krkr/energy/data/profile_configs.json`

### Cron not running
1. Check cron service: `systemctl status crond`
2. Verify crontab entry: `crontab -l`
3. Check cron logs: `/var/log/cron` or `journalctl -u crond`

### Missing plans
1. Refresh plan data: `python3 /home/krkr/energy/get_all_plans.py`
2. Check effective date filter in comparison_engine.py
3. Verify plan not in exclusion list

## Maintenance

### Update Profile Configurations

Edit `/home/krkr/energy/data/profile_configs.json` and adjust:
- `quarterly_consumption_kwh`
- `solar_export_kwh`
- `tou_split` percentages

### Cleanup Old History

```python
from monthly_reporter import get_history_manager

history = get_history_manager()
history.cleanup_old_history(keep_months=24)  # Keep 2 years
```

### View Statistics

```python
from monthly_reporter import get_history_manager

history = get_history_manager()
stats = history.get_statistics()
print(stats)
```

## Development

### Adding New Profiles

1. Edit `profile_configs.json`
2. Add new profile with consumption and TOU split
3. Run test: `python3 main.py --dry-run`

### Extending Retailers

Modify `baseline_retailers` in `main.py`:

```python
comparison_results = comparison_engine.run_monthly_comparison(
    profile_configs,
    baseline_retailers=["AGL", "Origin Energy", "Energy Locals"]
)
```

## Files & Locations

| File | Purpose |
|------|---------|
| `/home/krkr/energy/monthly_reporter/main.py` | Main entry point |
| `/home/krkr/energy/run_monthly_report.sh` | Cron wrapper script |
| `/home/krkr/energy/data/profile_configs.json` | Profile definitions |
| `/home/krkr/energy/data/plan_history.json` | Monthly snapshots |
| `/home/krkr/energy/all_energy_plans.json` | Latest plan data |
| `/home/krkr/wa_bot/` | WhatsApp bot integration |

## Support

For issues or questions:
1. Check logs in `/home/krkr/energy/monthly_reporter/*.log`
2. Run with `--verbose --dry-run` flags
3. Compare against frontend calculator for validation

---

**Version**: 1.0.0
**Last Updated**: 2025-11-02
**Author**: Automated Energy Plan Reporter System
