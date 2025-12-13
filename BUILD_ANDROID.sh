#!/bin/bash

# Android Build & Deploy Script for Earn Task Platform
# This script helps you build and deploy your Android app to Play Store

echo "🚀 Android Build & Deploy Script"
echo "=================================="
echo ""

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "📦 Installing EAS CLI..."
    npm install -g eas-cli
    echo "✅ EAS CLI installed"
else
    echo "✅ EAS CLI already installed"
fi

echo ""
echo "Step 1: Login to Expo"
echo "---------------------"
read -p "Press Enter to login to Expo (or Ctrl+C to cancel)..."
eas login

echo ""
echo "Step 2: Configure EAS Build (if not already done)"
echo "--------------------------------------------------"
read -p "Configure EAS build? (y/n): " configure
if [ "$configure" = "y" ]; then
    eas build:configure
fi

echo ""
echo "Step 3: Build Android App Bundle"
echo "----------------------------------"
echo "This will build the production AAB file for Play Store"
echo "Build time: ~15-30 minutes"
read -p "Start build? (y/n): " build
if [ "$build" = "y" ]; then
    eas build --platform android --profile production
    echo ""
    echo "✅ Build started! Check the URL provided above for progress"
    echo "📥 Download the AAB file when build completes"
fi

echo ""
echo "Step 4: Submit to Play Store"
echo "-----------------------------"
echo "Before submitting, make sure you have:"
echo "1. Created app in Google Play Console"
echo "2. Downloaded service account JSON key"
echo "3. Saved it as 'google-service-account.json' in project root"
read -p "Submit to Play Store? (y/n): " submit
if [ "$submit" = "y" ]; then
    if [ ! -f "google-service-account.json" ]; then
        echo "❌ Error: google-service-account.json not found"
        echo "Please download it from Play Console and place it in the project root"
        exit 1
    fi
    eas submit --platform android
    echo ""
    echo "✅ Submission started!"
fi

echo ""
echo "✨ Done! Check Play Console for submission status"
echo ""
echo "For detailed instructions, see: ANDROID_BUILD_GUIDE.md"
