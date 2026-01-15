#!/bin/bash

# Etched Local Development Startup Script
# This script starts all services for local development

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Starting Etched Local Development Environment"
echo "================================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if required tools are installed
check_requirements() {
    echo -e "${BLUE}Checking requirements...${NC}"
    
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is required but not installed."
        exit 1
    fi
    
    if ! command -v cargo &> /dev/null; then
        echo "❌ Rust/Cargo is required but not installed."
        exit 1
    fi
    
    echo -e "${GREEN}✓ All requirements met${NC}"
}

# Install dependencies
install_deps() {
    echo -e "\n${BLUE}Installing dependencies...${NC}"
    
    echo "📦 Installing contract dependencies..."
    cd "$PROJECT_ROOT/contracts"
    npm install --silent
    
    echo "📦 Installing frontend dependencies..."
    cd "$PROJECT_ROOT/frontend"
    npm install --silent
    
    echo -e "${GREEN}✓ Dependencies installed${NC}"
}

# Start Hardhat node
start_hardhat() {
    echo -e "\n${BLUE}Starting Hardhat node...${NC}"
    cd "$PROJECT_ROOT/contracts"
    npx hardhat node &
    HARDHAT_PID=$!
    echo "Hardhat PID: $HARDHAT_PID"
    sleep 5
    echo -e "${GREEN}✓ Hardhat node running on http://localhost:8545${NC}"
}

# Deploy contract
deploy_contract() {
    echo -e "\n${BLUE}Deploying smart contract...${NC}"
    cd "$PROJECT_ROOT/contracts"
    
    # Deploy and capture the address
    DEPLOY_OUTPUT=$(npx hardhat run scripts/deploy.js --network localhost 2>&1)
    CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oP '0x[a-fA-F0-9]{40}' | head -1)
    
    if [ -z "$CONTRACT_ADDRESS" ]; then
        echo "❌ Failed to deploy contract"
        echo "$DEPLOY_OUTPUT"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Contract deployed at: $CONTRACT_ADDRESS${NC}"
    
    # Update frontend .env.local
    echo "NEXT_PUBLIC_API_BASE=http://localhost:8080" > "$PROJECT_ROOT/frontend/.env.local"
    echo "NEXT_PUBLIC_CONTRACT_ADDRESS=$CONTRACT_ADDRESS" >> "$PROJECT_ROOT/frontend/.env.local"
    echo "NEXT_PUBLIC_CHAIN_ID=31337" >> "$PROJECT_ROOT/frontend/.env.local"
    
    echo -e "${GREEN}✓ Frontend .env.local updated${NC}"
}

# Start backend
start_backend() {
    echo -e "\n${BLUE}Starting Rust backend...${NC}"
    cd "$PROJECT_ROOT/backend"
    
    # Create .env if it doesn't exist
    if [ ! -f .env ]; then
        cp .env.example .env
        # Use hardhat's first account as admin
        sed -i 's/0xadmin.../0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266/' .env
    fi
    
    cargo run &
    BACKEND_PID=$!
    echo "Backend PID: $BACKEND_PID"
    sleep 3
    echo -e "${GREEN}✓ Backend running on http://localhost:8080${NC}"
}

# Start frontend
start_frontend() {
    echo -e "\n${BLUE}Starting Next.js frontend...${NC}"
    cd "$PROJECT_ROOT/frontend"
    npm run dev &
    FRONTEND_PID=$!
    echo "Frontend PID: $FRONTEND_PID"
    sleep 5
    echo -e "${GREEN}✓ Frontend running on http://localhost:3000${NC}"
}

# Cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down services...${NC}"
    kill $HARDHAT_PID 2>/dev/null || true
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    echo "Goodbye!"
}

trap cleanup EXIT

# Main
main() {
    check_requirements
    install_deps
    start_hardhat
    deploy_contract
    start_backend
    start_frontend
    
    echo -e "\n${GREEN}================================================${NC}"
    echo -e "${GREEN}🎉 Etched is now running!${NC}"
    echo -e "${GREEN}================================================${NC}"
    echo ""
    echo "📋 Services:"
    echo "   - Frontend:  http://localhost:3000"
    echo "   - Backend:   http://localhost:8080"
    echo "   - Hardhat:   http://localhost:8545"
    echo ""
    echo "🔑 Default Admin (Hardhat Account #0):"
    echo "   Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    echo "   Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    echo ""
    echo "Press Ctrl+C to stop all services."
    echo ""
    
    # Wait for user to cancel
    wait
}

main
