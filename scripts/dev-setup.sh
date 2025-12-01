#!/bin/bash

# Development setup script for DataMerge MCP

echo "🚀 Setting up DataMerge MCP development environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "🔧 Creating .env file..."
    cat > .env << EOF
# DataMerge API Configuration
# Optional: override base URL (defaults to https://api.datamerge.ai)
# DATAMERGE_BASE_URL=https://api.datamerge.ai

# Required: your DataMerge API key
DATAMERGE_API_KEY=your_datamerge_api_key_here
EOF
    echo "📝 Please update .env with your actual DataMerge API credentials"
fi

# Build the package
echo "🔨 Building package..."
npm run build

# Run tests
echo "🧪 Running tests..."
npm test

echo ""
echo "🎉 Development environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env with your DataMerge API credentials (DATAMERGE_API_KEY)"
echo "2. Run 'npm run dev' to start development mode"
echo "3. Run 'npm start' to start the MCP server"
echo "4. Run 'npm test' to run tests"
echo "5. Run 'npm run lint' to check code quality"
echo ""
echo "Happy coding! 🚀"
