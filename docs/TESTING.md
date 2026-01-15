# Testing Guide

This guide covers testing procedures for the Etched certificate SBT platform.

## Prerequisites

- Node.js 18+
- Rust 1.70+
- MetaMask browser extension

## Local Development Setup

### Quick Start

```bash
# Make the startup script executable
chmod +x scripts/start-local.sh

# Run everything
./scripts/start-local.sh
```

This script will:
1. Install all dependencies
2. Start Hardhat local node
3. Deploy the smart contract
4. Configure environment files
5. Start the backend API
6. Start the frontend

### Manual Setup

If you prefer manual setup:

```bash
# Terminal 1: Start Hardhat
cd contracts
npm install
npx hardhat node

# Terminal 2: Deploy contract
cd contracts
npx hardhat run scripts/deploy.js --network localhost
# Note the deployed address

# Terminal 3: Start backend
cd backend
cp .env.example .env
# Edit .env: set ADMIN_ADDRESSES to your wallet
cargo run

# Terminal 4: Start frontend
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local: set NEXT_PUBLIC_CONTRACT_ADDRESS
npm run dev
```

## MetaMask Configuration

1. **Add Local Network**
   - Network Name: `Hardhat Local`
   - RPC URL: `http://localhost:8545`
   - Chain ID: `31337`
   - Currency Symbol: `ETH`

2. **Import Test Account**
   - Use Hardhat's first account for admin:
   - Private Key: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
   - This address is `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

3. **Import Additional Accounts** (for testing multi-role)
   - Account #1 (Validator): `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`
   - Account #2 (Certificator): `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a`

## API Testing

### Health Check
```bash
curl http://localhost:8080/health
# Expected: "ok"
```

### Authentication Flow

```bash
# 1. Get nonce
curl -X POST http://localhost:8080/auth/nonce \
  -H 'Content-Type: application/json' \
  -d '{"address":"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"}'

# Response: {"nonce":"...","message":"Login to Etched: ..."}

# 2. Sign the message with the wallet (use MetaMask or ethers.js)

# 3. Verify signature
curl -X POST http://localhost:8080/auth/verify \
  -H 'Content-Type: application/json' \
  -d '{"address":"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","signature":"0x..."}'

# Response: {"token":"eyJ...","role":"admin"}
```

### Validator Management (Admin)

```bash
# Add validator (requires admin JWT)
curl -X POST http://localhost:8080/admin/validators \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "address": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    "institution_id": "INST-001",
    "institution_name": "Test University"
  }'

# List validators
curl http://localhost:8080/validators

# Get single validator
curl http://localhost:8080/validators/0x70997970c51812dc3a010c7d01b50e0d17dc79c8

# Remove validator (requires admin JWT)
curl -X DELETE http://localhost:8080/admin/validators/0x70997970c51812dc3a010c7d01b50e0d17dc79c8 \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### Metadata Creation

```bash
curl -X POST http://localhost:8080/metadata \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "certificate_name": "Bachelor of Computer Science",
    "recipient_name": "John Doe",
    "recipient_address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "institution_id": "INST-001",
    "institution_name": "Test University",
    "certificate_type": "diploma",
    "issued_at": "2024-01-15",
    "details": "Graduated with honors"
  }'

# Response: {"uri":"http://localhost:8080/metadata/UUID.json"}

# Fetch metadata
curl http://localhost:8080/metadata/UUID.json
```

### Certificate Requests

```bash
# Create request
curl -X POST http://localhost:8080/requests \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "recipient": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "certificate_hash": "0xabc...",
    "metadata_uri": "http://localhost:8080/metadata/UUID.json",
    "institution_id": "INST-001",
    "certificate_type": "diploma"
  }'

# List requests
curl http://localhost:8080/requests

# Filter by status
curl "http://localhost:8080/requests?status=pending"

# Get my requests (certificator's own)
curl http://localhost:8080/requests/my \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'

# Approve/Reject (validator only)
curl -X POST http://localhost:8080/requests/REQUEST_ID/decision \
  -H 'Authorization: Bearer VALIDATOR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"status":"approved","reason":"Verified"}'
```

## Smart Contract Testing

### Using Hardhat Console

```bash
cd contracts
npx hardhat console --network localhost
```

```javascript
// Get contract
const Contract = await ethers.getContractFactory("CertificateSBT")
const contract = await Contract.attach("DEPLOYED_ADDRESS")

// Check roles
await contract.hasRole(await contract.ADMIN_ROLE(), "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")

// Add validator
await contract.addValidator(
  "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
  "INST-001",
  "Test University"
)

// Submit certificate request
await contract.submitCertificateRequest(
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  "0x1234...", // certificate hash
  "http://localhost:8080/metadata/uuid.json",
  "INST-001",
  "diploma"
)

// Get request
await contract.getCertificateRequest(1)

// Approve (as validator)
// First switch to validator signer
const [admin, validator] = await ethers.getSigners()
await contract.connect(validator).approveCertificate(1)

// Verify by hash
await contract.verifyCertificateByHash("0x1234...")
```

## End-to-End Test Flow

1. **Setup**
   - Run `./scripts/start-local.sh`
   - Open http://localhost:3000

2. **Admin Flow**
   - Connect MetaMask with Account #0 (admin)
   - Sign in
   - Go to Admin tab
   - Add a validator (use Account #1 address with institution INST-001)

3. **Certificator Flow**
   - Switch MetaMask to Account #2
   - Sign in (will be certificator role)
   - Go to Certificator tab
   - Fill out certificate form
   - Submit request

4. **Validator Flow**
   - Switch MetaMask to Account #1
   - Sign in (will be validator role)
   - Go to Validator tab
   - See pending request
   - Click "Approve & Mint"

5. **Verify**
   - Copy the certificate hash from the request
   - Go to Verify section
   - Paste hash and verify
   - Should show "Valid" with token details

## Common Issues

### "Wrong network" badge
- Switch MetaMask to the Hardhat network (Chain ID: 31337)

### "Contract not found"
- Ensure `NEXT_PUBLIC_CONTRACT_ADDRESS` is set in frontend `.env.local`
- Redeploy if Hardhat was restarted

### "Validator not from this institution"
- The validator can only approve requests from their own institution
- Institution ID must match exactly

### Transaction fails
- Ensure you have ETH (Hardhat provides 10000 ETH to test accounts)
- Check you have the correct role for the action

## Build Verification

```bash
# Backend
cd backend
cargo build --release

# Frontend
cd frontend
npm run build

# Contracts
cd contracts
npx hardhat compile
```
