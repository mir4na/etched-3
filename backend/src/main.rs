//! Etched Backend API
//! 
//! Backend service for the Etched certificate SBT platform.
//! Provides authentication, validator management, certificate requests,
//! and metadata hosting.

mod config;
mod errors;
mod handlers;
mod middleware;
mod models;
mod state;

#[cfg(test)]
mod tests;

use actix_cors::Cors;
use actix_web::{get, web::Data, App, HttpResponse, HttpServer, Responder};
use std::fs;

use config::Config;
use state::AppState;

/// Health check endpoint
#[get("/health")]
async fn health() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION")
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Load configuration
    let config = Config::from_env();
    
    // Ensure metadata directory exists
    fs::create_dir_all(&config.metadata_dir).ok();

    let bind_addr = config.bind_addr.clone();
    let state = AppState::new(config);

    println!("🚀 Etched Backend starting...");
    println!("   Bind address: http://{}", bind_addr);
    println!("   Admin addresses: {:?}", state.config.admin_addresses);

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header();

        App::new()
            .app_data(Data::new(state.clone()))
            .wrap(cors)
            // Health check
            .service(health)
            // Auth endpoints
            .service(handlers::issue_nonce)
            .service(handlers::verify_signature)
            .service(handlers::get_profile)
            // Validator management
            .service(handlers::add_validator)
            .service(handlers::remove_validator)
            .service(handlers::list_validators)
            .service(handlers::get_validator)
            // Certificate requests
            .service(handlers::my_requests)
            .service(handlers::create_request)
            .service(handlers::list_requests)
            .service(handlers::get_request)
            .service(handlers::decide_request)
            // Metadata
            .service(handlers::create_metadata)
            .service(handlers::get_metadata)
    })
    .bind(&bind_addr)?
    .run()
    .await
}
