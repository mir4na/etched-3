

use actix_web::{get, post, web, HttpResponse, Responder};
use rand::Rng;

use crate::errors::ApiError;
use crate::middleware::AuthUser;
use crate::models::*;
use crate::state::AppState;


fn generate_pool_code() -> String {
    const CHARSET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut rng = rand::thread_rng();
    (0..6)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}


#[post("/pools")]
pub async fn create_pool(
    state: web::Data<AppState>,
    user: AuthUser,
    payload: web::Json<CreatePoolRequest>,
) -> Result<impl Responder, ApiError> {
    if user.auth_type != "email" {
        return Err(ApiError::BadRequest("Validators must use email login".into()));
    }

    let user_id: i32 = user.sub.parse().map_err(|_| ApiError::Internal)?;

    
    let validator_req: ValidatorRequest = sqlx::query_as(
        "SELECT * FROM validator_requests WHERE user_id = $1 AND status = 'approved' LIMIT 1"
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| ApiError::Internal)?
    .ok_or_else(|| ApiError::Forbidden)?;

    
    let db_user: User = sqlx::query_as("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| ApiError::Internal)?;

    if db_user.wallet_address.is_none() {
        return Err(ApiError::BadRequest("Please connect your wallet first".into()));
    }

    
    let mut code = generate_pool_code();
    loop {
        let exists: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM pools WHERE code = $1")
            .bind(&code)
            .fetch_one(&state.db)
            .await
            .map_err(|_| ApiError::Internal)?;
        
        if exists.0 == 0 {
            break;
        }
        code = generate_pool_code();
    }

    
    let pool: Pool = sqlx::query_as(r#"
        INSERT INTO pools (code, validator_id, name, description, tx_hash)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    "#)
    .bind(&code)
    .bind(user_id)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&payload.tx_hash)
    .fetch_one(&state.db)
    .await
    .map_err(|_| ApiError::Internal)?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Pool created successfully",
        "pool": {
            "id": pool.id,
            "code": pool.code,
            "name": pool.name,
            "tx_hash": pool.tx_hash
        },
        "institution_name": validator_req.institution_name
    })))
}


#[get("/pools/{code}")]
pub async fn get_pool(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> Result<impl Responder, ApiError> {
    let code = path.into_inner().to_uppercase();

    let pool: Pool = sqlx::query_as(
        "SELECT * FROM pools WHERE code = $1 AND is_active = true"
    )
    .bind(&code)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| ApiError::Internal)?
    .ok_or(ApiError::NotFound)?;

    
    let validator_req: ValidatorRequest = sqlx::query_as(
        "SELECT * FROM validator_requests WHERE user_id = $1 AND status = 'approved' LIMIT 1"
    )
    .bind(pool.validator_id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| ApiError::Internal)?;

    let validator: User = sqlx::query_as("SELECT * FROM users WHERE id = $1")
        .bind(pool.validator_id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| ApiError::Internal)?;

    Ok(HttpResponse::Ok().json(PoolResponse {
        id: pool.id,
        code: pool.code,
        name: pool.name,
        description: pool.description,
        validator_name: validator.username,
        institution_name: validator_req.institution_name,
        is_active: pool.is_active,
        created_at: pool.created_at,
    }))
}


#[get("/pools/my")]
pub async fn my_pools(
    state: web::Data<AppState>,
    user: AuthUser,
) -> Result<impl Responder, ApiError> {
    if user.auth_type != "email" {
        return Err(ApiError::BadRequest("Validators must use email login".into()));
    }

    let user_id: i32 = user.sub.parse().map_err(|_| ApiError::Internal)?;

    let pools: Vec<Pool> = sqlx::query_as(
        "SELECT * FROM pools WHERE validator_id = $1 ORDER BY created_at DESC"
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| ApiError::Internal)?;

    
    let mut results = Vec::new();
    for pool in pools {
        let pending: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM certificates WHERE pool_id = $1 AND status = 'pending'"
        )
        .bind(pool.id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| ApiError::Internal)?;

        let minted: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM certificates WHERE pool_id = $1 AND status = 'minted'"
        )
        .bind(pool.id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| ApiError::Internal)?;

        results.push(serde_json::json!({
            "pool": pool,
            "pending_certificates": pending.0,
            "minted_certificates": minted.0
        }));
    }

    Ok(HttpResponse::Ok().json(results))
}


#[post("/pools/{id}/toggle")]
pub async fn toggle_pool(
    state: web::Data<AppState>,
    user: AuthUser,
    path: web::Path<i32>,
) -> Result<impl Responder, ApiError> {
    if user.auth_type != "email" {
        return Err(ApiError::BadRequest("Validators must use email login".into()));
    }

    let user_id: i32 = user.sub.parse().map_err(|_| ApiError::Internal)?;
    let pool_id = path.into_inner();

    
    let pool: Pool = sqlx::query_as("SELECT * FROM pools WHERE id = $1")
        .bind(pool_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| ApiError::Internal)?
        .ok_or(ApiError::NotFound)?;

    if pool.validator_id != user_id {
        return Err(ApiError::Forbidden);
    }

    let new_status = !pool.is_active;
    sqlx::query("UPDATE pools SET is_active = $1 WHERE id = $2")
        .bind(new_status)
        .bind(pool_id)
        .execute(&state.db)
        .await
        .map_err(|_| ApiError::Internal)?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": if new_status { "Pool activated" } else { "Pool deactivated" },
        "is_active": new_status
    })))
}


#[get("/pools/info")]
pub async fn pool_info(
    state: web::Data<AppState>,
) -> Result<impl Responder, ApiError> {
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "admin_wallet": state.config.admin_wallet,
        "pool_cost_eth": state.config.pool_cost_eth
    })))
}
