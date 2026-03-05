# Pricing Platform Engine

A dynamic pricing strategy calculator for vehicles built with React.

## Overview

This application calculates dynamic pricing for different vehicle models based on distance and regression analysis. It allows users to:
- Select different car models
- Input trip distances
- View calculated prices with comparisons to original pricing
- Manually override base prices and per-km rates

## How to Deploy to Netlify

### Option 1: Deploy via GitHub (Recommended - Easiest)

1. **Create a GitHub Account** (if you don't have one)
   - Go to https://github.com and sign up

2. **Push Your Code to GitHub**
   - Open a terminal in this folder
   - Run these commands:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/PricingStrategy.git
   git push -u origin main
   ```

3. **Connect to Netlify**
   - Go to https://netlify.com and sign up (choose GitHub option)
   - Click "Add new site" → "Import an existing project"
   - Select your GitHub repository
   - Click "Deploy"

   **That's it!** Your app will be live on a Netlify URL within minutes.

### Option 2: Quick Deploy with Netlify CLI

1. Open terminal in this folder
2. Run:
   ```bash
   npm install -g netlify-cli
   netlify deploy --prod --dir=dist
   ```
3. Follow the prompts

### Option 3: Instant Deploy (No GitHub needed)

1. Go to https://netlify.com
2. Find the `dist` folder in this project
3. Drag and drop it onto Netlify
4. Your site is now live!

## Local Development

To run and test the app on your computer:

```bash
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

## Building for Production

To create an optimized version for deployment:

```bash
npm run build
```

This creates a `dist` folder with everything needed to deploy.

## Features

- **Multiple Car Models**: 50+ vehicle configurations
- **Dynamic Pricing Calculator**: Calculates rates based on distance
- **Price Comparison**: Shows dynamic vs. original pricing
- **Editable Overrides**: Manually adjust prices if needed
- **Summary Table**: Compare all trip options

## Created With

- React 18
- Vite
- Tailwind CSS
- Lucide React Icons

---

**Need Help?**
- Netlify Docs: https://docs.netlify.com
- Contact Netlify Support: https://www.netlify.com/support/