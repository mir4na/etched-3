# Etched API Documentation

## Overview

Etched API provides backend services for the certificate SBT platform:
- **Authentication** via wallet signature (EIP-191)
- **Validator management** for admin operations
- **Certificate requests** tracking and decisions
- **Metadata hosting** for on-chain token URIs

**Base URL**: `http://localhost:8080`

---

## Authentication

Etched uses wallet-based authentication with nonce signing.

### Flow

```
1. Client requests nonce for wallet address
2. User signs nonce message with wallet
3. Backend verifies signature and issues JWT
4. JWT used in Authorization header for protected routes
```

### Endpoints

#### POST `/auth/nonce`

Get a nonce for wallet signature.

**Request:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f..."
}
```

**Response:**
```json
{
  "nonce": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Login to Etched: 550e8400-e29b-41d4-a716-446655440000"
}
```

**Errors:**
- `400` - Invalid address format

---

#### POST `/auth/verify`

Verify signature and get JWT token.

**Request:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f...",
  "signature": "0x1234abcd..."
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "certificator"
}
```

**Roles returned:**
- `admin` - If address is in ADMIN_ADDRESSES env
- `validator` - If address is registered validator
- `certificator` - Default for all other addresses

**Errors:**
- `400` - Invalid signature or nonce not found
- `401` - Signature does not match address

---

#### GET `/profile/me`

Get current user profile. **Requires JWT.**

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f...",
  "role": "validator",
  "validator_profile": {
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f...",
    "institution_id": "INST-001",
    "institution_name": "Universitas Etched",
    "verified_at": "2024-01-15T10:30:00Z"
  }
}
```

---

## Validator Management

### POST `/admin/validators`

Add a new validator. **Admin only.**

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Request:**
```json
{
  "address": "0xValidatorAddress...",
  "institution_id": "INST-001",
  "institution_name": "Universitas Etched"
}
```

**Response:**
```json
{
  "address": "0xvalidatoraddress...",
  "institution_id": "INST-001",
  "institution_name": "Universitas Etched",
  "verified_at": "2024-01-15T10:30:00Z"
}
```

**Errors:**
- `403` - Not an admin

---

### DELETE `/admin/validators/{address}`

Remove a validator. **Admin only.**

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "message": "Validator removed"
}
```

**Errors:**
- `403` - Not an admin
- `404` - Validator not found

---

### GET `/validators`

List all registered validators. **Public.**

**Response:**
```json
[
  {
    "address": "0xvalidator1...",
    "institution_id": "INST-001",
    "institution_name": "Universitas Etched",
    "verified_at": "2024-01-15T10:30:00Z"
  },
  {
    "address": "0xvalidator2...",
    "institution_id": "INST-002",
    "institution_name": "Institut Teknologi",
    "verified_at": "2024-01-14T09:00:00Z"
  }
]
```

---

### GET `/validators/{address}`

Get single validator info. **Public.**

**Response:**
```json
{
  "address": "0xvalidator...",
  "institution_id": "INST-001",
  "institution_name": "Universitas Etched",
  "verified_at": "2024-01-15T10:30:00Z"
}
```

**Errors:**
- `404` - Validator not found

---

## Certificate Requests

### POST `/requests`

Create a certificate request. **Requires JWT (certificator/validator).**

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "recipient": "0xRecipientAddress...",
  "certificate_hash": "0xkeccak256hash...",
  "metadata_uri": "http://localhost:8080/metadata/abc123.json",
  "institution_id": "INST-001",
  "certificate_type": "diploma"
}
```

**Response:**
```json
{
  "request_id": "uuid-string",
  "certificator": "0xCertificatorAddress...",
  "recipient": "0xRecipientAddress...",
  "certificate_hash": "0xkeccak256hash...",
  "metadata_uri": "http://localhost:8080/metadata/abc123.json",
  "institution_id": "INST-001",
  "certificate_type": "diploma",
  "status": "pending",
  "created_at": "2024-01-15T10:30:00Z",
  "validated_at": null,
  "validated_by": null,
  "rejection_reason": null
}
```

---

### GET `/requests`

List certificate requests with optional filters.

**Query Parameters:**
| Parameter | Description |
|-----------|-------------|
| `status` | Filter by status: `pending`, `approved`, `rejected` |
| `institution_id` | Filter by institution |
| `certificator` | Filter by certificator address |

**Example:**
```
GET /requests?status=pending&institution_id=INST-001
```

**Response:**
```json
[
  {
    "request_id": "uuid-1",
    "certificator": "0x...",
    "recipient": "0x...",
    "certificate_hash": "0x...",
    "metadata_uri": "http://...",
    "institution_id": "INST-001",
    "certificate_type": "diploma",
    "status": "pending",
    "created_at": "2024-01-15T10:30:00Z",
    "validated_at": null,
    "validated_by": null,
    "rejection_reason": null
  }
]
```

---

### GET `/requests/{id}`

Get single request by ID.

**Response:** Same as single request object.

**Errors:**
- `404` - Request not found

---

### GET `/requests/my`

Get current user's submitted requests. **Requires JWT.**

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** Array of request objects where `certificator` matches current user.

---

### POST `/requests/{id}/decision`

Approve or reject a request. **Validator only.**

**Headers:**
```
Authorization: Bearer <validator-token>
```

**Request:**
```json
{
  "status": "approved",
  "reason": "Verified with institution records"
}
```

Or for rejection:
```json
{
  "status": "rejected",
  "reason": "Document mismatch with official records"
}
```

**Response:** Updated request object.

**Errors:**
- `403` - Not a validator
- `404` - Request not found

---

## Metadata

### POST `/metadata`

Create certificate metadata JSON. **Requires JWT.**

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "certificate_name": "Ijazah S1 Teknik Informatika",
  "recipient_name": "John Doe",
  "recipient_address": "0xRecipient...",
  "institution_id": "INST-001",
  "institution_name": "Universitas Etched",
  "certificate_type": "diploma",
  "issued_at": "2024-01-15",
  "details": "Graduated with honors"
}
```

**Response:**
```json
{
  "uri": "http://localhost:8080/metadata/uuid-123.json"
}
```

This URI is used as the `tokenURI` for the minted SBT.

---

### GET `/metadata/{id}.json`

Fetch metadata JSON. **Public.**

**Response:**
```json
{
  "name": "Ijazah S1 Teknik Informatika",
  "description": "Graduated with honors",
  "issued_at": "2024-01-15",
  "recipient": {
    "name": "John Doe",
    "address": "0xRecipient..."
  },
  "institution": {
    "id": "INST-001",
    "name": "Universitas Etched"
  },
  "type": "diploma",
  "issuer": "0xCertificator..."
}
```

---

## Health Check

### GET `/health`

Simple health check endpoint.

**Response:**
```json
"ok"
```

---

## Use Cases

### Use Case 1: Admin Registers Validator

**Scenario:** University admin wants to add a staff member as validator.

```bash
# 1. Admin gets nonce
curl -X POST http://localhost:8080/auth/nonce \
  -H 'Content-Type: application/json' \
  -d '{"address":"0xAdminAddress"}'

# 2. Admin signs message in wallet, gets signature
# 3. Admin verifies signature
curl -X POST http://localhost:8080/auth/verify \
  -H 'Content-Type: application/json' \
  -d '{"address":"0xAdminAddress","signature":"0x..."}'

# Response: {"token":"eyJ...","role":"admin"}

# 4. Admin adds validator
curl -X POST http://localhost:8080/admin/validators \
  -H 'Authorization: Bearer eyJ...' \
  -H 'Content-Type: application/json' \
  -d '{
    "address": "0xValidatorAddress",
    "institution_id": "UNIV-ITB-001",
    "institution_name": "Institut Teknologi Bandung"
  }'

# 5. Admin also calls addValidator on smart contract via frontend
```

---

### Use Case 2: Certificator Submits Certificate

**Scenario:** University staff submits a graduation certificate for minting.

```bash
# 1. Certificator logs in (get nonce, sign, verify)

# 2. Create metadata
curl -X POST http://localhost:8080/metadata \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "certificate_name": "Bachelor of Computer Science",
    "recipient_name": "Ahmad Santoso",
    "recipient_address": "0xStudentWallet",
    "institution_id": "UNIV-ITB-001",
    "institution_name": "Institut Teknologi Bandung",
    "certificate_type": "diploma",
    "issued_at": "2024-07-20",
    "details": "GPA 3.85, Cum Laude"
  }'

# Response: {"uri":"http://localhost:8080/metadata/abc123.json"}

# 3. Hash the certificate data (done in frontend with ethers.js)
# 4. Submit on-chain via smart contract submitCertificateRequest()
# 5. Save to backend for tracking

curl -X POST http://localhost:8080/requests \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "recipient": "0xStudentWallet",
    "certificate_hash": "0xabc123...",
    "metadata_uri": "http://localhost:8080/metadata/abc123.json",
    "institution_id": "UNIV-ITB-001",
    "certificate_type": "diploma"
  }'
```

---

### Use Case 3: Validator Approves Request

**Scenario:** Validator reviews and approves a pending certificate.

```bash
# 1. Validator logs in

# 2. Get pending requests for their institution
curl -X GET 'http://localhost:8080/requests?status=pending&institution_id=UNIV-ITB-001' \
  -H 'Authorization: Bearer <validator-token>'

# 3. Approve on-chain via approveCertificate(requestId)
# This mints the SBT to the recipient

# 4. Update backend status
curl -X POST http://localhost:8080/requests/abc-uuid/decision \
  -H 'Authorization: Bearer <validator-token>' \
  -H 'Content-Type: application/json' \
  -d '{"status":"approved","reason":"Verified with registrar records"}'
```

---

### Use Case 4: Public Certificate Verification

**Scenario:** Employer wants to verify a job applicant's certificate.

```bash
# Option 1: Via frontend
# Enter certificate hash on verification page
# Frontend calls verifyCertificateByHash() on smart contract

# Option 2: Direct contract call
# Using ethers.js or web3.js:
# contract.verifyCertificateByHash("0xcertificatehash...")
# Returns: (isValid, tokenId, recipient, institutionId, mintedAt)

# Option 3: Block explorer
# Go to contract on Polygonscan/Etherscan
# Read contract → verifyCertificateByHash
# Enter hash → Get verification result
```

---

## Error Codes

| Code | Meaning |
|------|---------|
| `400` | Bad Request - Invalid input data |
| `401` | Unauthorized - Missing or invalid JWT |
| `403` | Forbidden - Insufficient permissions |
| `404` | Not Found - Resource doesn't exist |
| `500` | Internal Server Error |

---

## Rate Limits

Currently no rate limits. For production:
- `/auth/*` - 10 requests/minute per IP
- Other endpoints - 100 requests/minute per user

---

## Testing

```bash
# Health check
curl http://localhost:8080/health

# Full auth flow test
ADDRESS="0x70997970c51812dc3a010c7d01b50e0d17dc79c8"

# Get nonce
NONCE_RESP=$(curl -s -X POST http://localhost:8080/auth/nonce \
  -H 'Content-Type: application/json' \
  -d "{\"address\":\"$ADDRESS\"}")

echo $NONCE_RESP
# Sign the message in your wallet, then verify...
```
