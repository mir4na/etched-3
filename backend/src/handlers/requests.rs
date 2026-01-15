//! Certificate request handlers

use actix_web::{get, post, web, HttpResponse, Responder};
use chrono::Utc;
use std::collections::HashMap;

use crate::errors::ApiError;
use crate::middleware::AuthUser;
use crate::models::{DecisionPayload, RequestCreatePayload, RequestRecord};
use crate::state::AppState;

/// Create a new certificate request
#[post("/requests")]
pub async fn create_request(
    state: web::Data<AppState>,
    user: AuthUser,
    payload: web::Json<RequestCreatePayload>,
) -> Result<impl Responder, ApiError> {
    // Admin cannot create requests
    if user.role == "admin" {
        return Err(ApiError::Forbidden);
    }

    let request_id = uuid::Uuid::new_v4().to_string();
    let record = RequestRecord {
        request_id: request_id.clone(),
        certificator: user.address,
        recipient: payload.recipient.clone(),
        certificate_hash: payload.certificate_hash.clone(),
        metadata_uri: payload.metadata_uri.clone(),
        institution_id: payload.institution_id.clone(),
        certificate_type: payload.certificate_type.clone(),
        status: "pending".into(),
        created_at: Utc::now(),
        validated_at: None,
        validated_by: None,
        rejection_reason: None,
    };

    let mut store = state.store.lock().map_err(|_| ApiError::Internal)?;
    store.requests.insert(request_id, record.clone());

    Ok(HttpResponse::Ok().json(record))
}

/// List certificate requests with optional filters
#[get("/requests")]
pub async fn list_requests(
    state: web::Data<AppState>,
    query: web::Query<HashMap<String, String>>,
) -> Result<impl Responder, ApiError> {
    let store = state.store.lock().map_err(|_| ApiError::Internal)?;
    let mut records: Vec<RequestRecord> = store.requests.values().cloned().collect();

    // Filter by institution_id
    if let Some(institution_id) = query.get("institution_id") {
        records.retain(|r| &r.institution_id == institution_id);
    }
    
    // Filter by status
    if let Some(status) = query.get("status") {
        records.retain(|r| &r.status == status);
    }
    
    // Filter by certificator
    if let Some(certificator) = query.get("certificator") {
        records.retain(|r| r.certificator.to_lowercase() == certificator.to_lowercase());
    }

    Ok(HttpResponse::Ok().json(records))
}

/// Get single request by ID
#[get("/requests/{id}")]
pub async fn get_request(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> Result<impl Responder, ApiError> {
    let store = state.store.lock().map_err(|_| ApiError::Internal)?;
    let record = store
        .requests
        .get(&path.into_inner())
        .cloned()
        .ok_or(ApiError::NotFound)?;
    
    Ok(HttpResponse::Ok().json(record))
}

/// Get current user's requests
#[get("/requests/my")]
pub async fn my_requests(
    state: web::Data<AppState>,
    user: AuthUser,
) -> Result<impl Responder, ApiError> {
    let store = state.store.lock().map_err(|_| ApiError::Internal)?;
    let records: Vec<RequestRecord> = store
        .requests
        .values()
        .filter(|r| r.certificator.to_lowercase() == user.address.to_lowercase())
        .cloned()
        .collect();
    
    Ok(HttpResponse::Ok().json(records))
}

/// Approve or reject a request (validator only)
#[post("/requests/{id}/decision")]
pub async fn decide_request(
    state: web::Data<AppState>,
    user: AuthUser,
    path: web::Path<String>,
    payload: web::Json<DecisionPayload>,
) -> Result<impl Responder, ApiError> {
    if user.role != "validator" {
        return Err(ApiError::Forbidden);
    }

    let mut store = state.store.lock().map_err(|_| ApiError::Internal)?;
    let record = store
        .requests
        .get_mut(&path.into_inner())
        .ok_or(ApiError::NotFound)?;

    record.status = payload.status.clone();
    record.validated_at = Some(Utc::now());
    record.validated_by = Some(user.address);
    record.rejection_reason = payload.reason.clone();

    Ok(HttpResponse::Ok().json(record.clone()))
}
