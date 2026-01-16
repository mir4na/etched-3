use actix_web::{get, post, web, HttpResponse, Responder};
use chrono::Utc;
use ethers_core::types::Signature;
use ethers_core::utils::hash_message;
use jsonwebtoken::{encode, EncodingKey, Header};
use std::str::FromStr;

use crate::errors::ApiError;
use crate::middleware::AuthUser;
use crate::models::*;
use crate::state::AppState;

const SIGNING_MESSAGE_PREFIX: &str = "Login to Etched";

#[post("/auth/login")]
pub async fn login(
    state: web::Data<AppState>,
    payload: web::Json<LoginRequest>,
) -> Result<impl Responder, ApiError> {
    let email = payload.email.to_lowercase();

    let user: User = sqlx::query_as("SELECT * FROM users WHERE email = $1")
        .bind(&email)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| ApiError::Internal)?
        .ok_or(ApiError::Unauthorized)?;

    let valid =
        bcrypt::verify(&payload.password, &user.password_hash).map_err(|_| ApiError::Internal)?;

    if !valid {
        return Err(ApiError::Unauthorized);
    }

    let exp = (Utc::now().timestamp() + 60 * 60 * 24) as usize;
    let claims = Claims {
        sub: user.id.to_string(),
        role: user.role.clone(),
        auth_type: "email".into(),
        exp,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.config.jwt_secret.as_bytes()),
    )
    .map_err(|_| ApiError::Internal)?;

    Ok(HttpResponse::Ok().json(LoginResponse {
        token,
        role: user.role.clone(),
        user: user.into(),
    }))
}

#[post("/auth/register")]
pub async fn register(
    state: web::Data<AppState>,
    payload: web::Json<RegisterRequest>,
) -> Result<impl Responder, ApiError> {
    let email = payload.email.to_lowercase();

    let exists: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users WHERE email = $1")
        .bind(&email)
        .fetch_one(&state.db)
        .await
        .map_err(|_| ApiError::Internal)?;

    if exists.0 > 0 {
        return Err(ApiError::BadRequest("Email already registered".into()));
    }

    let password_hash =
        bcrypt::hash(&payload.password, bcrypt::DEFAULT_COST).map_err(|_| ApiError::Internal)?;

    let user: User = sqlx::query_as(
        r#"
        INSERT INTO users (email, password_hash, username, role)
        VALUES ($1, $2, $3, 'validator')
        RETURNING *
    "#,
    )
    .bind(&email)
    .bind(&password_hash)
    .bind(&payload.username)
    .fetch_one(&state.db)
    .await
    .map_err(|_| ApiError::Internal)?;

    sqlx::query(
        r#"
        INSERT INTO validator_requests (user_id, institution_name, institution_id, document_url)
        VALUES ($1, $2, $3, $4)
    "#,
    )
    .bind(user.id)
    .bind(&payload.institution_name)
    .bind(&payload.institution_id)
    .bind(&payload.document_url)
    .execute(&state.db)
    .await
    .map_err(|_| ApiError::Internal)?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Registration successful. Please wait for admin approval.",
        "user": UserPublic::from(user)
    })))
}

#[post("/auth/nonce")]
pub async fn get_nonce(
    state: web::Data<AppState>,
    payload: web::Json<NonceRequest>,
) -> Result<impl Responder, ApiError> {
    let address = payload.address.to_lowercase();

    if !address.starts_with("0x") || address.len() != 42 {
        return Err(ApiError::BadRequest("Invalid address format".into()));
    }

    let nonce = uuid::Uuid::new_v4().to_string();
    let message = format!("{}: {}", SIGNING_MESSAGE_PREFIX, nonce);

    let mut nonces = state.nonces.lock().map_err(|_| ApiError::Internal)?;
    println!("Storing nonce for address: {}", address);
    nonces.insert(address, nonce.clone());

    Ok(HttpResponse::Ok().json(NonceResponse { nonce, message }))
}

#[post("/auth/verify-wallet")]
pub async fn verify_wallet(
    state: web::Data<AppState>,
    payload: web::Json<VerifyWalletRequest>,
) -> Result<impl Responder, ApiError> {
    let address = payload.address.trim().to_lowercase();

    let nonce = {
        let mut nonces = state.nonces.lock().map_err(|_| ApiError::Internal)?;
        nonces.remove(&address).ok_or_else(|| {
            println!("Nonce not found for address: {}", address);

            println!("Available keys: {:?}", nonces.keys());
            ApiError::BadRequest(format!("Nonce not found for {}", address).into())
        })?
    };

    let message = format!("{}: {}", SIGNING_MESSAGE_PREFIX, nonce);
    println!("Verifying message: {}", message);

    let signature = Signature::from_str(payload.signature.trim())
        .map_err(|e| ApiError::BadRequest(format!("Invalid signature format: {}", e).into()))?;

    let message_hash = hash_message(&message);
    let recovered = signature
        .recover(message_hash)
        .map_err(|e| ApiError::BadRequest(format!("Signature recovery failed: {}", e).into()))?;

    let recovered_addr = format!("0x{:x}", recovered);
    println!(
        "Recovered (len {}): {:?}",
        recovered_addr.len(),
        recovered_addr
    );
    println!("Expected  (len {}): {:?}", address.len(), address);

    if recovered_addr != address {
        return Err(ApiError::BadRequest(
            format!(
                "Unauthorized: recovered {} (len {}) != expected {} (len {})",
                recovered_addr,
                recovered_addr.len(),
                address,
                address.len()
            )
            .into(),
        ));
    }

    let exp = (Utc::now().timestamp() + 60 * 60 * 12) as usize;
    let claims = Claims {
        sub: address.clone(),
        role: "certificator".into(),
        auth_type: "wallet".into(),
        exp,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.config.jwt_secret.as_bytes()),
    )
    .map_err(|_| ApiError::Internal)?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "token": token,
        "role": "certificator",
        "address": address
    })))
}

#[get("/auth/me")]
pub async fn get_me(
    state: web::Data<AppState>,
    user: AuthUser,
) -> Result<impl Responder, ApiError> {
    if user.auth_type == "wallet" {
        return Ok(HttpResponse::Ok().json(serde_json::json!({
            "address": user.sub,
            "role": "certificator",
            "auth_type": "wallet"
        })));
    }

    let user_id: i32 = user.sub.parse().map_err(|_| ApiError::Internal)?;
    let db_user: User = sqlx::query_as("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| ApiError::Internal)?
        .ok_or(ApiError::NotFound)?;

    let request: Option<ValidatorRequest> = if db_user.role == "validator" {
        sqlx::query_as(
            "SELECT * FROM validator_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        )
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| ApiError::Internal)?
    } else {
        None
    };

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "user": UserPublic::from(db_user),
        "validator_request": request,
        "auth_type": "email"
    })))
}

#[post("/auth/connect-wallet")]
pub async fn connect_wallet(
    state: web::Data<AppState>,
    user: AuthUser,
    payload: web::Json<ConnectWalletRequest>,
) -> Result<impl Responder, ApiError> {
    if user.auth_type != "email" {
        return Err(ApiError::BadRequest(
            "Only email users can connect wallet".into(),
        ));
    }

    let user_id: i32 = user.sub.parse().map_err(|_| ApiError::Internal)?;
    let wallet = payload.wallet_address.to_lowercase();

    sqlx::query("UPDATE users SET wallet_address = $1 WHERE id = $2")
        .bind(&wallet)
        .bind(user_id)
        .execute(&state.db)
        .await
        .map_err(|_| ApiError::Internal)?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Wallet connected successfully",
        "wallet_address": wallet
    })))
}
