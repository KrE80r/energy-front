# Interactive SA Energy Plan Advisor

A user-friendly web application that helps South Australian households find the best Time of Use (TOU) electricity plans based on their usage patterns and solar setup.

## Features

### 🏠 Persona-Based Recommendations
- **Commuter (No Solar)**: Away during day, evening usage
- **Work From Home (No Solar)**: High daytime usage  
- **Commuter (With Solar)**: Solar export during day
- **Work From Home (With Solar)**: High self-consumption

### ⚡ Advanced Cost Calculation
- Implements unified electricity bill calculation formula
- Supports both solar and non-solar households
- Accurate TOU rate calculations with peak/shoulder/off-peak periods
- Includes supply charges, fees, and solar feed-in credits

### 📊 Rich Visual Experience
- Interactive 24-hour TOU timeline visualization
- Clean, professional plan comparison cards
- Color-coded rate information
- Strategic recommendations for each plan

### 🎯 Personalization Options
- Quick estimates using persona defaults
- Custom usage pattern input for precise calculations
- Real-time validation and feedback
- Progressive disclosure (simple to advanced)

## Technical Stack

- **Frontend**: Pure HTML/CSS/JavaScript (no build process)
- **Styling**: Bootstrap 5 + Custom CSS
- **Data**: Static JSON file with 142 TOU energy plans
- **Hosting**: GitHub Pages compatible

## Usage

### Quick Start
1. Open `index.html` in your browser or visit the live site
2. Select your household persona from the 4 options
3. View instant cost estimates and recommendations
4. Compare top 5 plans ranked by total cost

### Custom Analysis
1. Click "Customize Usage" after selecting a persona
2. Enter your actual quarterly consumption and usage percentages
3. Add solar details if applicable
4. Get personalized recommendations based on your exact usage

### Understanding Results
- **Cost Display**: Shows quarterly, monthly, and supply charge costs
- **Rate Breakdown**: P (Peak), S (Shoulder), O (Off-Peak), Supply, FiT (Feed-in Tariff)
- **Timeline**: Visual representation of 24-hour TOU periods
- **Strategic Verdict**: Explanation of why each plan is recommended

## Data Source

Energy plan data is sourced from the South Australia government API:
- **API**: `https://api.energymadeeasy.gov.au/consumerplan/plans`
- **Focus**: TOU (Time of Use) plans for residential customers
- **Coverage**: All major energy retailers in South Australia
- **Update**: Data extracted on 2025-06-25

## Calculation Formula

The application uses a unified formula that works for both solar and non-solar households:

1. **Supply Charge**: `Daily Rate × 91 days ÷ 100`
2. **Net Consumption**: `Total Consumption - Solar Self-Consumed`
3. **Usage Charge**: Apply TOU rates to net consumption
4. **Solar Credit**: `Solar Exported × Feed-in Rate ÷ 100`
5. **Final Bill**: `Supply + Usage - Solar Credit`

## Browser Support

- Modern browsers with ES6+ support
- Responsive design for mobile and desktop
- Graceful fallbacks for older browsers

## Development

### Local Testing
```bash
# Start local server
python3 -m http.server 8000

# Visit http://localhost:8000
```

### File Structure
```
/
├── index.html              # Main application
├── all_energy_plans.json   # Energy plan data
├── css/
│   └── style.css           # Styling and layout
├── js/
│   ├── personas.js         # Household type definitions
│   ├── calculator.js       # Cost calculation engine
│   ├── ui.js              # User interface controller
│   └── app.js             # Main application logic
└── README.md              # This file
```

## Deployment

This application is designed for GitHub Pages:

1. Push to GitHub repository
2. Enable GitHub Pages in repository settings
3. Set custom domain (e.g., energy.nazmy.io)
4. Application will be automatically deployed

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Support

For issues or questions:
- Check the browser console for error messages
- Ensure JavaScript is enabled
- Verify internet connection for data loading
- Test with a modern browser

## Acknowledgments

- Energy plan data provided by the South Australian Government
- Bootstrap framework for responsive design
- Inter font family for typography
