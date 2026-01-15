//! Authentication handlers

use actix_web::{get, post, web, HttpResponse, Responder};
use chrono::Utc;
use ethers_core::types::Signature;
use ethers_core::utils::hash_message;
use jsonwebtoken::{encode, EncodingKey, Header};
use std::str::FromStr;

use crate::errors::ApiError;
use crate::middleware::AuthUser;
use crate::models::{Claims, NonceRequest, NonceResponse, VerifyRequest, VerifyResponse};
use crate::state::AppState;

const SIGNING_MESSAGE_PREFIX: &str = "Login to Etched";

/// Get nonce for wallet signature
#[post("/auth/nonce")]
pub async fn issue_nonce(
    state: web::Data<AppState>,
    payload: web::Json<NonceRequest>,
) -> Result<impl Responder, ApiError> {
    let address = payload.address.to_lowercase();
    
    if !address.starts_with("0x") || address.len() != 42 {
        return Err(ApiError::BadRequest("Invalid address format".into()));
    }

    let nonce = uuid::Uuid::new_v4().to_string();
    let message = format!("{}: {}", SIGNING_MESSAGE_PREFIX, nonce);
    
    let mut store = state.store.lock().map_err(|_| ApiError::Internal)?;
    store.nonces.insert(address, nonce.clone());

    Ok(HttpResponse::Ok().json(NonceResponse { nonce, message }))
}

/// Verify wallet signature and issue JWT
#[post("/auth/verify")]
pub async fn verify_signature(
    state: web::Data<AppState>,
    payload: web::Json<VerifyRequest>,
) -> Result<impl Responder, ApiError> {
    let address = payload.address.to_lowercase();
    
    let nonce = {
        let mut store = state.store.lock().map_err(|_| ApiError::Internal)?;
        store.nonces
            .remove(&address)
            .ok_or_else(|| ApiError::BadRequest("Nonce not found".into()))?
    };
    
    let message = format!("{}: {}", SIGNING_MESSAGE_PREFIX, nonce);

    let signature = Signature::from_str(payload.signature.trim())
        .map_err(|_| ApiError::BadRequest("Invalid signature format".into()))?;
    
    let message_hash = hash_message(&message);
    let recovered = signature
        .recover(message_hash)
        .map_err(|_| ApiError::BadRequest("Signature recovery failed".into()))?;

    if recovered.to_string().to_lowercase() != address {
        return Err(ApiError::Unauthorized);
    }

    let role = state.resolve_role(&address);
    let exp = (Utc::now().timestamp() + 60 * 60 * 12) as usize; // 12 hours
    
    let claims = Claims {
        sub: address,
        role: role.clone(),
        exp,
    };
    
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.config.jwt_secret.as_bytes()),
    )
    .map_err(|_| ApiError::Internal)?;

    Ok(HttpResponse::Ok().json(VerifyResponse { token, role }))
}

/// Get current user profile
#[get("/profile/me")]
pub async fn get_profile(
    state: web::Data<AppState>,
    user: AuthUser,
) -> Result<impl Responder, ApiError> {
    let store = state.store.lock().map_err(|_| ApiError::Internal)?;
    let validator = store.validators.get(&user.address).cloned();
    
    let response = serde_json::json!({
        "address": user.address,
        "role": user.role,
        "validator_profile": validator,
    });
    
    Ok(HttpResponse::Ok().json(response))
}
