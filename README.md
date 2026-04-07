# Pricing Platform Engine

A comprehensive pricing strategy platform with dynamic pricing calculator and trip package analyzer built with React.

## Overview

This application provides two powerful tools for pricing strategy analysis:

### 🧮 **Pricing Calculator**
- **Dynamic Pricing**: Calculates rates based on distance and regression analysis
- **50+ Car Models**: Extensive database of vehicle configurations
- **Price Comparison**: Shows dynamic pricing vs. original fixed pricing
- **Manual Overrides**: Adjust base prices and rates as needed
- **Summary Table**: Compare all trip options

### 📊 **Trip Package Analyzer**
- **Package Configuration**: Define km/day limits for 3 or 4 range models
- **30+ Locations**: Pre-loaded with popular tourist destinations
- **Profitability Analysis**: Automatically analyzes which locations are profitable
- **Company vs Customer Advantage**: Visual indicators for pricing strategy
- **Editable Parameters**: Modify distances, days, and package assignments

## Features

- **Dual Tools**: Switch between pricing calculator and package analyzer
- **Interactive Tables**: Edit distances, days, and pricing parameters
- **Visual Indicators**: Color-coded profitability analysis
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time Calculations**: Instant updates as you modify parameters

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
   npx netlify-cli deploy --prod --dir=dist
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

## Navigation

- **Calculator Tab**: Dynamic pricing calculator for individual trips
- **Trip Package Analyzer Tab**: Analyze profitability across multiple locations

## Created With

- React 18
- Vite
- Tailwind CSS
- Lucide React Icons

---

**Live Demo**: [https://pricingstrategywz.netlify.app](https://pricingstrategywz.netlify.app)

**Need Help?**
- Netlify Docs: https://docs.netlify.com
- Contact Netlify Support: https://www.netlify.com/support/