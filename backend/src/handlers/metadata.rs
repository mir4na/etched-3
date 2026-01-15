//! Metadata handlers

use actix_web::{get, post, web, HttpResponse, Responder};
use std::fs;
use std::path::PathBuf;

use crate::errors::ApiError;
use crate::middleware::AuthUser;
use crate::models::MetadataPayload;
use crate::state::AppState;

/// Create metadata JSON file
#[post("/metadata")]
pub async fn create_metadata(
    state: web::Data<AppState>,
    user: AuthUser,
    payload: web::Json<MetadataPayload>,
) -> Result<impl Responder, ApiError> {
    // Admin cannot create metadata
    if user.role == "admin" {
        return Err(ApiError::Forbidden);
    }

    let metadata_id = uuid::Uuid::new_v4().to_string();
    let record = serde_json::json!({
        "name": payload.certificate_name,
        "description": payload.details,
        "issued_at": payload.issued_at,
        "recipient": {
            "name": payload.recipient_name,
            "address": payload.recipient_address
        },
        "institution": {
            "id": payload.institution_id,
            "name": payload.institution_name
        },
        "type": payload.certificate_type,
        "issuer": user.address
    });

    let path = PathBuf::from(&state.config.metadata_dir)
        .join(format!("{}.json", metadata_id));
    
    fs::write(
        &path,
        serde_json::to_string_pretty(&record).map_err(|_| ApiError::Internal)?,
    )
    .map_err(|_| ApiError::Internal)?;

    let uri = format!(
        "{}/metadata/{}.json",
        state.config.public_base_url.trim_end_matches('/'),
        metadata_id
    );

    Ok(HttpResponse::Ok().json(serde_json::json!({ "uri": uri })))
}

/// Fetch metadata by ID
#[get("/metadata/{id}.json")]
pub async fn get_metadata(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> Result<impl Responder, ApiError> {
    let file_path = PathBuf::from(&state.config.metadata_dir)
        .join(format!("{}.json", path.into_inner()));
    
    let content = fs::read_to_string(file_path).map_err(|_| ApiError::NotFound)?;
    
    Ok(HttpResponse::Ok()
        .content_type("application/json")
        .body(content))
}
