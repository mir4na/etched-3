//! Data models and types

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Validator profile representing an institution validator
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ValidatorProfile {
    pub address: String,
    pub institution_id: String,
    pub institution_name: String,
    pub verified_at: DateTime<Utc>,
}

/// Certificate request record for tracking
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RequestRecord {
    pub request_id: String,
    pub certificator: String,
    pub recipient: String,
    pub certificate_hash: String,
    pub metadata_uri: String,
    pub institution_id: String,
    pub certificate_type: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub validated_at: Option<DateTime<Utc>>,
    pub validated_by: Option<String>,
    pub rejection_reason: Option<String>,
}

/// JWT claims structure
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub role: String,
    pub exp: usize,
}

// ============ Request/Response DTOs ============

/// Auth nonce request
#[derive(Debug, Deserialize)]
pub struct NonceRequest {
    pub address: String,
}

/// Auth nonce response
#[derive(Debug, Serialize)]
pub struct NonceResponse {
    pub nonce: String,
    pub message: String,
}

/// Auth verify request
#[derive(Debug, Deserialize)]
pub struct VerifyRequest {
    pub address: String,
    pub signature: String,
}

/// Auth verify response
#[derive(Debug, Serialize)]
pub struct VerifyResponse {
    pub token: String,
    pub role: String,
}

/// Validator creation request
#[derive(Debug, Deserialize)]
pub struct ValidatorCreateRequest {
    pub address: String,
    pub institution_id: String,
    pub institution_name: String,
}

/// Certificate request creation payload
#[derive(Debug, Deserialize)]
pub struct RequestCreatePayload {
    pub recipient: String,
    pub certificate_hash: String,
    pub metadata_uri: String,
    pub institution_id: String,
    pub certificate_type: String,
}

/// Request decision payload
#[derive(Debug, Deserialize)]
pub struct DecisionPayload {
    pub status: String,
    pub reason: Option<String>,
}

/// Metadata creation payload
#[derive(Debug, Deserialize)]
pub struct MetadataPayload {
    pub certificate_name: String,
    pub recipient_name: String,
    pub recipient_address: String,
    pub institution_id: String,
    pub institution_name: String,
    pub certificate_type: String,
    pub issued_at: String,
    pub details: Option<String>,
}
