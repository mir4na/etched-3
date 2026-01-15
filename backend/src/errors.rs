//! Error types and handling

use actix_web::HttpResponse;
use thiserror::Error;

/// API error types
#[derive(Debug, Error)]
pub enum ApiError {
    #[error("Unauthorized")]
    Unauthorized,
    
    #[error("Forbidden")]
    Forbidden,
    
    #[error("Bad request: {0}")]
    BadRequest(String),
    
    #[error("Not found")]
    NotFound,
    
    #[error("Internal server error")]
    Internal,
}

impl actix_web::ResponseError for ApiError {
    fn error_response(&self) -> HttpResponse {
        match self {
            ApiError::Unauthorized => {
                HttpResponse::Unauthorized().json(serde_json::json!({
                    "error": "unauthorized",
                    "message": self.to_string()
                }))
            }
            ApiError::Forbidden => {
                HttpResponse::Forbidden().json(serde_json::json!({
                    "error": "forbidden",
                    "message": self.to_string()
                }))
            }
            ApiError::BadRequest(msg) => {
                HttpResponse::BadRequest().json(serde_json::json!({
                    "error": "bad_request",
                    "message": msg
                }))
            }
            ApiError::NotFound => {
                HttpResponse::NotFound().json(serde_json::json!({
                    "error": "not_found",
                    "message": self.to_string()
                }))
            }
            ApiError::Internal => {
                HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "internal_error",
                    "message": self.to_string()
                }))
            }
        }
    }
}
