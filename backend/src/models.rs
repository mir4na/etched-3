

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;




#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: i32,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub username: String,
    pub role: String, 
    pub wallet_address: Option<String>,
    pub created_at: DateTime<Utc>,
}


#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ValidatorRequest {
    pub id: i32,
    pub user_id: i32,
    pub institution_name: String,
    pub institution_id: String,
    pub document_url: Option<String>,
    pub status: String, 
    pub reviewed_by: Option<i32>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub rejection_reason: Option<String>,
    pub created_at: DateTime<Utc>,
}


#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Pool {
    pub id: i32,
    pub code: String,
    pub validator_id: i32,
    pub name: String,
    pub description: Option<String>,
    pub tx_hash: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}


#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Certificate {
    pub id: i32,
    pub pool_id: i32,
    pub certificator_wallet: String,
    pub recipient_name: String,
    pub recipient_wallet: String,
    pub certificate_type: String,
    pub document_hash: String,
    pub metadata_uri: Option<String>,
    pub status: String, 
    pub token_id: Option<i32>,
    pub tx_hash: Option<String>,
    pub validated_at: Option<DateTime<Utc>>,
    pub minted_at: Option<DateTime<Utc>>,
    pub rejection_reason: Option<String>,
    pub created_at: DateTime<Utc>,
}



#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, 
    pub role: String,
    pub auth_type: String, 
    pub exp: usize,
}




#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}


#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub role: String,
    pub user: UserPublic,
}


#[derive(Debug, Serialize)]
pub struct UserPublic {
    pub id: i32,
    pub email: String,
    pub username: String,
    pub role: String,
    pub wallet_address: Option<String>,
}

impl From<User> for UserPublic {
    fn from(u: User) -> Self {
        Self {
            id: u.id,
            email: u.email,
            username: u.username,
            role: u.role,
            wallet_address: u.wallet_address,
        }
    }
}


#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub username: String,
    pub institution_name: String,
    pub institution_id: String,
    pub document_url: Option<String>,
}


#[derive(Debug, Deserialize)]
pub struct NonceRequest {
    pub address: String,
}


#[derive(Debug, Serialize)]
pub struct NonceResponse {
    pub nonce: String,
    pub message: String,
}


#[derive(Debug, Deserialize)]
pub struct VerifyWalletRequest {
    pub address: String,
    pub signature: String,
}


#[derive(Debug, Deserialize)]
pub struct CreatePoolRequest {
    pub name: String,
    pub description: Option<String>,
    pub tx_hash: String,
}


#[derive(Debug, Serialize)]
pub struct PoolResponse {
    pub id: i32,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub validator_name: String,
    pub institution_name: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}


#[derive(Debug, Deserialize)]
pub struct SubmitCertificateRequest {
    pub recipient_name: String,
    pub recipient_wallet: String,
    pub certificate_type: String,
    pub document_hash: String,
    pub metadata_uri: Option<String>,
}


#[derive(Debug, Deserialize)]
pub struct CertificateDecisionRequest {
    pub approve: bool,
    pub tx_hash: Option<String>,
    pub token_id: Option<i32>,
    pub rejection_reason: Option<String>,
}


#[derive(Debug, Deserialize)]
pub struct ValidatorDecisionRequest {
    pub approve: bool,
    pub rejection_reason: Option<String>,
}


#[derive(Debug, Deserialize)]
pub struct ConnectWalletRequest {
    pub wallet_address: String,
}
