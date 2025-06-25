# GitHub Pages Deployment Guide

## 📁 Deployment Files Location

All GitHub Pages deployment files are located in the `/docs` directory:

```
docs/
├── index.html              # Main application page
├── all_energy_plans.json   # Energy plan data (142 TOU plans)
├── CNAME                   # Custom domain configuration
├── .nojekyll              # Disable Jekyll processing
├── css/
│   └── style.css          # Complete styling and layout
└── js/
    ├── personas.js        # Household type definitions
    ├── calculator.js      # Cost calculation engine  
    ├── ui.js             # User interface controller
    └── app.js            # Main application logic
```

## 🚀 GitHub Pages Setup Instructions

### Step 1: Repository Setup
1. Push this repository to GitHub
2. Go to your repository settings
3. Navigate to "Pages" in the left sidebar

### Step 2: Configure Source
1. **Source**: Deploy from a branch
2. **Branch**: `main` (or your default branch)
3. **Folder**: `/docs`
4. Click "Save"

### Step 3: Custom Domain (Optional)
1. The `CNAME` file is already configured for `energy.nazmy.io`
2. In your domain provider's DNS settings, add a CNAME record:
   - **Name**: `energy` (or `@` for root domain)
   - **Value**: `yourusername.github.io`
3. GitHub will automatically use the domain from the CNAME file

### Step 4: Verify Deployment
1. GitHub will provide a deployment URL (usually within 5-10 minutes)
2. Visit the URL to test the application
3. If using custom domain, it may take up to 24 hours for DNS propagation

## 🔧 Technical Notes

### Why `/docs` Directory?
- GitHub Pages supports deployment from `/docs` folder
- Keeps deployment files separate from development files
- Easier to manage what gets deployed vs. what stays in repository

### Key Files Explained

**`CNAME`**: Contains your custom domain name
```
energy.nazmy.io
```

**`.nojekyll`**: Tells GitHub Pages not to process files with Jekyll
- Prevents Jekyll from ignoring files starting with underscore
- Ensures all CSS/JS files load correctly
- Required for non-Jekyll static sites

**File Structure**: Organized for optimal loading
- CSS and JS files in separate directories
- All assets accessible via relative paths
- No build process required

## 📱 Testing Locally

Before deploying, test locally:

```bash
# Navigate to docs directory
cd docs

# Start local server
python3 -m http.server 8000

# Visit http://localhost:8000
```

## ✅ Deployment Checklist

- [ ] All files copied to `/docs` directory
- [ ] `CNAME` file configured with your domain
- [ ] `.nojekyll` file present
- [ ] Repository pushed to GitHub
- [ ] GitHub Pages enabled in repository settings
- [ ] Source set to "Deploy from branch: main /docs"
- [ ] DNS configured (if using custom domain)
- [ ] Application tested locally
- [ ] Deployment URL verified

## 🌐 Live URLs

Once deployed, your application will be available at:
- **GitHub Pages URL**: `https://yourusername.github.io/repository-name`
- **Custom Domain**: `https://energy.nazmy.io` (after DNS setup)

## 🛠 Updating the Site

To update the deployed application:
1. Make changes to files in the `/docs` directory
2. Commit and push to GitHub
3. GitHub Pages will automatically redeploy (usually within 1-2 minutes)

## 🔍 Troubleshooting

**Site not loading?**
- Check that files are in `/docs` directory
- Verify GitHub Pages is enabled
- Ensure branch and folder are correctly configured

**Custom domain not working?**
- Verify CNAME file contains correct domain
- Check DNS settings with your domain provider
- Allow up to 24 hours for DNS propagation

**JavaScript errors?**
- Check browser console for error messages
- Ensure all file paths are relative (no leading slashes)
- Verify `.nojekyll` file is present

**CSS not loading?**
- Check file paths in HTML
- Ensure CSS files are in `/docs/css/` directory
- Clear browser cache and refresh

## 📞 Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify all files are present in `/docs` directory
3. Test locally before deploying
4. Check GitHub Pages deployment status in repository settings