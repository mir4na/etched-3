use actix_web::{get, post, web, HttpResponse, Responder};
use chrono::Utc;

use crate::errors::ApiError;
use crate::middleware::AuthUser;
use crate::models::*;
use crate::state::AppState;

#[post("/pools/{code}/certificates")]
pub async fn submit_certificate(
    state: web::Data<AppState>,
    user: AuthUser,
    path: web::Path<String>,
    payload: web::Json<SubmitCertificateRequest>,
) -> Result<impl Responder, ApiError> {
    if user.auth_type != "wallet" {
        return Err(ApiError::BadRequest(
            "Certificators must use wallet login".into(),
        ));
    }

    let code = path.into_inner().to_uppercase();
    let wallet = user.sub.to_lowercase();

    let pool: Pool = sqlx::query_as("SELECT * FROM pools WHERE code = $1 AND is_active = true")
        .bind(&code)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| ApiError::Internal)?
        .ok_or_else(|| ApiError::BadRequest("Pool not found or inactive".into()))?;

    let exists: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM certificates WHERE document_hash = $1")
            .bind(&payload.document_hash)
            .fetch_one(&state.db)
            .await
            .map_err(|_| ApiError::Internal)?;

    if exists.0 > 0 {
        return Err(ApiError::BadRequest("Certificate already submitted".into()));
    }

    let cert: Certificate = sqlx::query_as(
        r#"
        INSERT INTO certificates (
            pool_id, certificator_wallet, recipient_name, recipient_wallet,
            certificate_type, document_hash, metadata_uri
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
    "#,
    )
    .bind(pool.id)
    .bind(&wallet)
    .bind(&payload.recipient_name)
    .bind(&payload.recipient_wallet.to_lowercase())
    .bind(&payload.certificate_type)
    .bind(&payload.document_hash)
    .bind(&payload.metadata_uri)
    .fetch_one(&state.db)
    .await
    .map_err(|_| ApiError::Internal)?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Certificate submitted successfully",
        "certificate": {
            "id": cert.id,
            "document_hash": cert.document_hash,
            "status": cert.status
        }
    })))
}

#[get("/pools/{code}/certificates")]
pub async fn list_pool_certificates(
    state: web::Data<AppState>,
    user: AuthUser,
    path: web::Path<String>,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> Result<impl Responder, ApiError> {
    let code = path.into_inner().to_uppercase();

    let pool: Pool = sqlx::query_as("SELECT * FROM pools WHERE code = $1")
        .bind(&code)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| ApiError::Internal)?
        .ok_or(ApiError::NotFound)?;

    if user.auth_type == "email" {
        let user_id: i32 = user.sub.parse().map_err(|_| ApiError::Internal)?;
        if pool.validator_id != user_id && user.role != "admin" {
            return Err(ApiError::Forbidden);
        }
    }

    let status_filter = query.get("status");
    let certificates: Vec<Certificate> = if let Some(status) = status_filter {
        sqlx::query_as(
            "SELECT * FROM certificates WHERE pool_id = $1 AND status = $2 ORDER BY created_at DESC"
        )
        .bind(pool.id)
        .bind(status)
        .fetch_all(&state.db)
        .await
        .map_err(|_| ApiError::Internal)?
    } else {
        sqlx::query_as("SELECT * FROM certificates WHERE pool_id = $1 ORDER BY created_at DESC")
            .bind(pool.id)
            .fetch_all(&state.db)
            .await
            .map_err(|_| ApiError::Internal)?
    };

    Ok(HttpResponse::Ok().json(certificates))
}

#[post("/certificates/{id}/decision")]
pub async fn decide_certificate(
    state: web::Data<AppState>,
    user: AuthUser,
    path: web::Path<i32>,
    payload: web::Json<CertificateDecisionRequest>,
) -> Result<impl Responder, ApiError> {
    if user.auth_type != "email" {
        return Err(ApiError::BadRequest(
            "Validators must use email login".into(),
        ));
    }

    let user_id: i32 = user.sub.parse().map_err(|_| ApiError::Internal)?;
    let cert_id = path.into_inner();

    let cert: Certificate = sqlx::query_as("SELECT * FROM certificates WHERE id = $1")
        .bind(cert_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| ApiError::Internal)?
        .ok_or(ApiError::NotFound)?;

    if cert.status != "pending" {
        return Err(ApiError::BadRequest("Certificate already processed".into()));
    }

    let pool: Pool = sqlx::query_as("SELECT * FROM pools WHERE id = $1")
        .bind(cert.pool_id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| ApiError::Internal)?;

    if pool.validator_id != user_id {
        return Err(ApiError::Forbidden);
    }

    if payload.approve {
        let tx_hash = payload
            .tx_hash
            .as_ref()
            .ok_or_else(|| ApiError::BadRequest("tx_hash required for approval".into()))?;
        let token_id = payload
            .token_id
            .ok_or_else(|| ApiError::BadRequest("token_id required for approval".into()))?;

        sqlx::query(
            r#"
            UPDATE certificates 
            SET status = 'minted', tx_hash = $1, token_id = $2, 
                validated_at = $3, minted_at = $3
            WHERE id = $4
        "#,
        )
        .bind(tx_hash)
        .bind(token_id)
        .bind(Utc::now())
        .bind(cert_id)
        .execute(&state.db)
        .await
        .map_err(|_| ApiError::Internal)?;

        Ok(HttpResponse::Ok().json(serde_json::json!({
            "message": "Certificate approved and minted",
            "status": "minted",
            "token_id": token_id,
            "tx_hash": tx_hash
        })))
    } else {
        sqlx::query(
            r#"
            UPDATE certificates 
            SET status = 'rejected', rejection_reason = $1, validated_at = $2
            WHERE id = $3
        "#,
        )
        .bind(&payload.rejection_reason)
        .bind(Utc::now())
        .bind(cert_id)
        .execute(&state.db)
        .await
        .map_err(|_| ApiError::Internal)?;

        Ok(HttpResponse::Ok().json(serde_json::json!({
            "message": "Certificate rejected",
            "status": "rejected"
        })))
    }
}

#[get("/certificates/my")]
pub async fn my_certificates(
    state: web::Data<AppState>,
    user: AuthUser,
) -> Result<impl Responder, ApiError> {
    if user.auth_type != "wallet" {
        return Err(ApiError::BadRequest(
            "Certificators must use wallet login".into(),
        ));
    }

    let wallet = user.sub.to_lowercase();

    let certificates: Vec<Certificate> = sqlx::query_as(
        "SELECT * FROM certificates WHERE certificator_wallet = $1 ORDER BY created_at DESC",
    )
    .bind(&wallet)
    .fetch_all(&state.db)
    .await
    .map_err(|_| ApiError::Internal)?;

    let mut results = Vec::new();
    for cert in certificates {
        let pool: Pool = sqlx::query_as("SELECT * FROM pools WHERE id = $1")
            .bind(cert.pool_id)
            .fetch_one(&state.db)
            .await
            .map_err(|_| ApiError::Internal)?;

        results.push(serde_json::json!({
            "certificate": cert,
            "pool_name": pool.name,
            "pool_code": pool.code
        }));
    }

    Ok(HttpResponse::Ok().json(results))
}

#[get("/certificates/verify/{hash}")]
pub async fn verify_certificate(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> Result<impl Responder, ApiError> {
    let hash = path.into_inner();

    let cert: Option<Certificate> =
        sqlx::query_as("SELECT * FROM certificates WHERE document_hash = $1 AND status = 'minted'")
            .bind(&hash)
            .fetch_optional(&state.db)
            .await
            .map_err(|_| ApiError::Internal)?;

    if let Some(cert) = cert {
        let pool: Pool = sqlx::query_as("SELECT * FROM pools WHERE id = $1")
            .bind(cert.pool_id)
            .fetch_one(&state.db)
            .await
            .map_err(|_| ApiError::Internal)?;

        let validator_req: ValidatorRequest = sqlx::query_as(
            "SELECT * FROM validator_requests WHERE user_id = $1 AND status = 'approved' LIMIT 1",
        )
        .bind(pool.validator_id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| ApiError::Internal)?;

        Ok(HttpResponse::Ok().json(serde_json::json!({
            "valid": true,
            "certificate": {
                "recipient_name": cert.recipient_name,
                "recipient_wallet": cert.recipient_wallet,
                "certificate_type": cert.certificate_type,
                "document_hash": cert.document_hash,
                "token_id": cert.token_id,
                "tx_hash": cert.tx_hash,
                "minted_at": cert.minted_at
            },
            "issuer": {
                "institution_name": validator_req.institution_name,
                "institution_id": validator_req.institution_id,
                "pool_name": pool.name
            }
        })))
    } else {
        Ok(HttpResponse::Ok().json(serde_json::json!({
            "valid": false,
            "message": "Certificate not found or not yet minted"
        })))
    }
}

#[get("/stats")]
pub async fn public_stats(state: web::Data<AppState>) -> Result<impl Responder, ApiError> {
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
        "total_validators": total_validators.0,
        "total_pools": total_pools.0,
        "total_certificates": total_certificates.0
    })))
}
