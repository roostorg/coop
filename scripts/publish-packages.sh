#!/bin/bash

# Script to publish packages to @roostorg npm registry
# Make sure you're logged into npm with proper permissions

set -e

echo "🚀 Publishing packages to @roostorg scope..."

# Check if user is logged in to npm
if ! npm whoami > /dev/null 2>&1; then
    echo "❌ Not logged in to npm. Please run:"
    echo "   npm login"
    echo "   Use your npm username and password/token"
    exit 1
fi

echo "✅ Logged in to npm as: $(npm whoami)"

# Check if OTP is provided
if [ -z "$NPM_OTP" ]; then
    echo "⚠️  Two-factor authentication is enabled. Please provide OTP:"
    echo "   export NPM_OTP=<your-otp-code>"
    echo "   ./scripts/publish-packages.sh"
    echo ""
    echo "Or run with OTP directly:"
    echo "   NPM_OTP=<your-otp-code> ./scripts/publish-packages.sh"
    exit 1
fi

# Function to check if package version exists
check_version_exists() {
    local package_name=$1
    local version=$2
    
    if npm view "$package_name@$version" version >/dev/null 2>&1; then
        echo "⚠️  Version $version of $package_name already exists on npm"
        return 0
    else
        echo "✅ Version $version of $package_name is available for publishing"
        return 1
    fi
}

# Function to publish package if version doesn't exist
publish_if_needed() {
    local package_dir=$1
    local package_name=$2
    
    cd "$package_dir"
    
    # Get current version from package.json
    local version=$(node -p "require('./package.json').version")
    
    echo "📦 Checking $package_name@$version..."
    
    if check_version_exists "$package_name" "$version"; then
        echo "⏭️  Skipping $package_name@$version (already published)"
        cd ..
        return
    fi
    
    echo "📦 Publishing $package_name@$version..."
    npm install
    npm run build
    npm publish --otp=$NPM_OTP
    cd ..
}

# Publish packages
publish_if_needed "types" "@roostorg/types"
publish_if_needed "migrator" "@roostorg/db-migrator"

echo "✅ All packages published successfully!"
echo ""
echo "Next steps:"
echo "1. Run 'npm install' in server/ and client/ directories to update dependencies"
echo "2. The GitHub Action will automatically publish future changes when you push to main/OSS branches"
echo "3. Make sure to add NPM_TOKEN secret to your GitHub repository for automated publishing"
