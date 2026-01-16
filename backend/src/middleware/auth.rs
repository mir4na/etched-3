

use actix_web::{web::Data, FromRequest, HttpRequest};
use jsonwebtoken::{decode, DecodingKey, Validation};

use crate::errors::ApiError;
use crate::models::Claims;
use crate::state::AppState;


#[derive(Debug, Clone)]
pub struct AuthUser {
    pub sub: String,       
    pub role: String,      
    pub auth_type: String, 
}

impl FromRequest for AuthUser {
    type Error = ApiError;
    type Future = std::pin::Pin<Box<dyn std::future::Future<Output = Result<Self, Self::Error>>>>;

    fn from_request(req: &HttpRequest, _: &mut actix_web::dev::Payload) -> Self::Future {
        let auth_header = req
            .headers()
            .get("Authorization")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());
        
        let jwt_secret = req
            .app_data::<Data<AppState>>()
            .map(|s| s.config.jwt_secret.clone());

        Box::pin(async move {
            let token = auth_header
                .and_then(|header| header.strip_prefix("Bearer ").map(|s| s.to_string()))
                .ok_or(ApiError::Unauthorized)?;
            
            let secret = jwt_secret.ok_or(ApiError::Internal)?;
            
            let token_data = decode::<Claims>(
                &token,
                &DecodingKey::from_secret(secret.as_bytes()),
                &Validation::default(),
            )
            .map_err(|_| ApiError::Unauthorized)?;

            Ok(AuthUser {
                sub: token_data.claims.sub,
                role: token_data.claims.role,
                auth_type: token_data.claims.auth_type,
            })
        })
    }
}
