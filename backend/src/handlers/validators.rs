//! Validator management handlers

use actix_web::{delete, get, post, web, HttpResponse, Responder};
use chrono::Utc;

use crate::errors::ApiError;
use crate::middleware::AuthUser;
use crate::models::{ValidatorCreateRequest, ValidatorProfile};
use crate::state::AppState;

/// Add a new validator (admin only)
#[post("/admin/validators")]
pub async fn add_validator(
    state: web::Data<AppState>,
    user: AuthUser,
    payload: web::Json<ValidatorCreateRequest>,
) -> Result<impl Responder, ApiError> {
    if user.role != "admin" {
        return Err(ApiError::Forbidden);
    }

    let address = payload.address.to_lowercase();
    let new_validator = ValidatorProfile {
        address: address.clone(),
        institution_id: payload.institution_id.clone(),
        institution_name: payload.institution_name.clone(),
        verified_at: Utc::now(),
    };

    let mut store = state.store.lock().map_err(|_| ApiError::Internal)?;
    store.validators.insert(address, new_validator.clone());

    Ok(HttpResponse::Ok().json(new_validator))
}

/// Remove a validator (admin only)
#[delete("/admin/validators/{address}")]
pub async fn remove_validator(
    state: web::Data<AppState>,
    user: AuthUser,
    path: web::Path<String>,
) -> Result<impl Responder, ApiError> {
    if user.role != "admin" {
        return Err(ApiError::Forbidden);
    }

    let address = path.into_inner().to_lowercase();
    let mut store = state.store.lock().map_err(|_| ApiError::Internal)?;
    
    if store.validators.remove(&address).is_none() {
        return Err(ApiError::NotFound);
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({"message": "Validator removed"})))
}

/// List all validators
#[get("/validators")]
pub async fn list_validators(
    state: web::Data<AppState>,
) -> Result<impl Responder, ApiError> {
    let store = state.store.lock().map_err(|_| ApiError::Internal)?;
    let validators: Vec<_> = store.validators.values().cloned().collect();
    Ok(HttpResponse::Ok().json(validators))
}

/// Get single validator by address
#[get("/validators/{address}")]
pub async fn get_validator(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> Result<impl Responder, ApiError> {
    let address = path.into_inner().to_lowercase();
    let store = state.store.lock().map_err(|_| ApiError::Internal)?;
    
    let validator = store
        .validators
        .get(&address)
        .cloned()
        .ok_or(ApiError::NotFound)?;
    
    Ok(HttpResponse::Ok().json(validator))
}
