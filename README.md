# Etched - Web3 Certificate SBT Platform

<div align="center">

![Etched Logo](https://img.shields.io/badge/Etched-SBT%20Certificates-orange?style=for-the-badge)
![Ethereum](https://img.shields.io/badge/Ethereum-3C3C3D?style=for-the-badge&logo=Ethereum&logoColor=white)
![Polygon](https://img.shields.io/badge/Polygon-8247E5?style=for-the-badge&logo=polygon&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000?style=for-the-badge&logo=next.js&logoColor=white)

**Mint tamper-proof graduation certificates and diplomas as Soulbound Tokens**

</div>

---

## 🎯 Overview

Etched is a decentralized platform for issuing and verifying academic credentials as **Soulbound Tokens (SBT)**. SBTs are non-transferable NFTs permanently bound to a recipient's wallet, making them ideal for credentials that should never be sold or transferred.

### Key Features

- 🔐 **Soulbound Tokens** - Certificates cannot be transferred or sold
- ✅ **Multi-level verification** - Admin → Validator → Certificator workflow
- 🏛️ **Institution-based** - Validators are tied to specific institutions
- 🔍 **On-chain verification** - Anyone can verify a certificate by its hash
- 🌐 **Wallet-based auth** - No passwords, just sign with your wallet

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│    Backend      │────▶│  Smart Contract │
│    (Next.js)    │     │   (Actix Web)   │     │  (Solidity)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
   React + ethers.js      JWT + Wallet Auth       ERC721 + SBT
   Wallet Connect         Metadata Hosting        AccessControl
```

### Roles

| Role | Description |
|------|-------------|
| **Admin** | Verifies validators from institutions. Adds/removes validators on-chain. |
| **Validator** | Reviews certificate requests. Approves or rejects, triggering SBT mint. |
| **Certificator** | Submits certificate data. Receives hash for public verification. |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Rust 1.70+
- MetaMask or compatible wallet

### 1. Setup Smart Contract

```bash
cd contracts
npm install
cp .env.example .env
# Edit .env with your PRIVATE_KEY

# Start local Hardhat node
npx hardhat node

# Deploy (in new terminal)
npx hardhat run scripts/deploy.js --network localhost
```

Save the deployed contract address for frontend config.

### 2. Setup Backend

```bash
cd backend
cp .env.example .env
# Edit .env - set ADMIN_ADDRESSES to your wallet address

cargo run
# Server runs at http://localhost:8080
```

### 3. Setup Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local:
# - NEXT_PUBLIC_CONTRACT_ADDRESS=<deployed address>
# - NEXT_PUBLIC_CHAIN_ID=31337

npm run dev
# App runs at http://localhost:3000
```

### 4. Configure MetaMask

1. Add network: `http://localhost:8545` (Chain ID: 31337)
2. Import test account from Hardhat (first account is admin)
3. Connect wallet on the app

---

## 📖 Workflow

### 1. Admin Verifies Validator
```
Admin wallet → Sign in → Add validator address + institution info → On-chain tx
```

### 2. Certificator Submits Request
```
Certificator → Fill certificate form → Create metadata → Submit on-chain request
```

### 3. Validator Approves
```
Validator → View pending requests → Verify off-chain → Approve → SBT minted to recipient
```

### 4. Public Verification
```
Anyone → Enter certificate hash → Verify on-chain → See token details
```

---

## 🔧 Environment Variables

### Backend (`.env`)
```bash
JWT_SECRET=your-secret-key
ADMIN_ADDRESSES=0xYourAdminWallet,0xAnotherAdmin
PUBLIC_BASE_URL=http://localhost:8080
BIND_ADDR=0.0.0.0:8080
```

### Frontend (`.env.local`)
```bash
NEXT_PUBLIC_API_BASE=http://localhost:8080
NEXT_PUBLIC_CONTRACT_ADDRESS=0xDeployedContractAddress
NEXT_PUBLIC_CHAIN_ID=31337
```

### Contracts (`.env`)
```bash
PRIVATE_KEY=0xYourPrivateKey
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
MUMBAI_RPC_URL=https://polygon-mumbai.infura.io/v3/YOUR_KEY
POLYGON_RPC_URL=https://polygon-mainnet.infura.io/v3/YOUR_KEY
```

---

## 📚 API Documentation

See [docs/API.md](docs/API.md) for complete API reference.

### Quick Examples

```bash
# Get auth nonce
curl -X POST http://localhost:8080/auth/nonce \
  -H 'Content-Type: application/json' \
  -d '{"address":"0x..."}'

# List validators
curl http://localhost:8080/validators

# Create metadata (requires JWT)
curl -X POST http://localhost:8080/metadata \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"certificate_name":"Diploma","recipient_name":"John",...}'
```

---

## 🔗 Networks

| Network | Chain ID | Status |
|---------|----------|--------|
| Localhost | 31337 | Development |
| Sepolia | 11155111 | Testnet |
| Polygon Mumbai | 80001 | Testnet |
| Polygon Mainnet | 137 | Production |

---

## 📁 Project Structure

```
etched/
├── contracts/           # Solidity smart contracts
│   ├── CertificateSBT.sol
│   ├── scripts/deploy.js
│   └── hardhat.config.js
├── backend/             # Rust Actix Web API
│   ├── src/main.rs
│   └── Cargo.toml
├── frontend/            # Next.js React app
│   ├── src/app/
│   ├── src/lib/
│   └── package.json
├── docs/                # Documentation
│   └── API.md
└── README.md
```

---

## 🛡️ Security

- **Soulbound**: Tokens cannot be transferred after minting
- **Role-based access**: Smart contract enforces Admin/Validator permissions
- **Signature verification**: Backend verifies EIP-191 signatures
- **Institution binding**: Validators can only approve requests from their institution

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">
  <b>Built with ❤️ for trustworthy credentials</b>
</div>
