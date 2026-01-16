use actix_web::{get, post, web, HttpResponse, Responder};
use chrono::Utc;

use crate::errors::ApiError;
use crate::middleware::AuthUser;
use crate::models::*;
use crate::state::AppState;

#[get("/admin/validator-requests")]
pub async fn list_validator_requests(
    state: web::Data<AppState>,
    user: AuthUser,
) -> Result<impl Responder, ApiError> {
    if user.role != "admin" {
        return Err(ApiError::Forbidden);
    }

    let requests: Vec<ValidatorRequest> = sqlx::query_as(
        "SELECT * FROM validator_requests WHERE status = 'pending' ORDER BY created_at ASC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|_| ApiError::Internal)?;

    let mut results = Vec::new();
    for req in requests {
        let user: User = sqlx::query_as("SELECT * FROM users WHERE id = $1")
            .bind(req.user_id)
            .fetch_one(&state.db)
            .await
            .map_err(|_| ApiError::Internal)?;

        results.push(serde_json::json!({
            "request": req,
            "user": UserPublic::from(user)
        }));
    }

    Ok(HttpResponse::Ok().json(results))
}

#[post("/admin/validator-requests/{id}/decision")]
pub async fn decide_validator_request(
    state: web::Data<AppState>,
    user: AuthUser,
    path: web::Path<i32>,
    payload: web::Json<ValidatorDecisionRequest>,
) -> Result<impl Responder, ApiError> {
    if user.role != "admin" {
        return Err(ApiError::Forbidden);
    }

    let request_id = path.into_inner();
    let admin_id: i32 = user.sub.parse().map_err(|_| ApiError::Internal)?;

    let _request: ValidatorRequest =
        sqlx::query_as("SELECT * FROM validator_requests WHERE id = $1")
            .bind(request_id)
            .fetch_optional(&state.db)
            .await
            .map_err(|_| ApiError::Internal)?
            .ok_or(ApiError::NotFound)?;

    let status = if payload.approve {
        "approved"
    } else {
        "rejected"
    };

    sqlx::query(
        r#"
        UPDATE validator_requests 
        SET status = $1, reviewed_by = $2, reviewed_at = $3, rejection_reason = $4
        WHERE id = $5
    "#,
    )
    .bind(status)
    .bind(admin_id)
    .bind(Utc::now())
    .bind(&payload.rejection_reason)
    .bind(request_id)
    .execute(&state.db)
    .await
    .map_err(|_| ApiError::Internal)?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": format!("Validator request {}", status),
        "status": status
    })))
}

#[get("/admin/validators")]
pub async fn list_validators(
    state: web::Data<AppState>,
    user: AuthUser,
) -> Result<impl Responder, ApiError> {
    if user.role != "admin" {
        return Err(ApiError::Forbidden);
    }

    let users: Vec<User> = sqlx::query_as(
        r#"
        SELECT u.* FROM users u
        JOIN validator_requests vr ON u.id = vr.user_id
        WHERE u.role = 'validator' AND vr.status = 'approved'
    "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|_| ApiError::Internal)?;

    let mut results = Vec::new();
    for u in users {
        let req: ValidatorRequest = sqlx::query_as(
            "SELECT * FROM validator_requests WHERE user_id = $1 AND status = 'approved' LIMIT 1",
        )
        .bind(u.id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| ApiError::Internal)?;

        results.push(serde_json::json!({
            "user": UserPublic::from(u),
            "institution_name": req.institution_name,
            "institution_id": req.institution_id,
            "approved_at": req.reviewed_at
        }));
    }

    Ok(HttpResponse::Ok().json(results))
}

#[get("/admin/stats")]
pub async fn admin_stats(
    state: web::Data<AppState>,
    user: AuthUser,
) -> Result<impl Responder, ApiError> {
    if user.role != "admin" {
        return Err(ApiError::Forbidden);
    }

    let pending_requests: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM validator_requests WHERE status = 'pending'")
            .fetch_one(&state.db)
            .await
            .map_err(|_| ApiError::Internal)?;

    let total_validators: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM validator_requests WHERE status = 'approved'")
            .fetch_one(&state.db)
            .await
            .map_err(|_| ApiError::Internal)?;

    let total_pools: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM pools")
        .fetch_one(&state.db)
        .await
        .map_err(|_| ApiError::Internal)?;

    let total_certificates: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM certificates WHERE status = 'minted'")
            .fetch_one(&state.db)
            .await
            .map_err(|_| ApiError::Internal)?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "pending_requests": pending_requests.0,
        "total_validators": total_validators.0,
        "total_pools": total_pools.0,
        "total_certificates": total_certificates.0,
        "admin_wallet": state.config.admin_wallet,
        "pool_cost_eth": state.config.pool_cost_eth
    })))
}
