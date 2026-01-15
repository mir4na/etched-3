//! Etched Backend API
//! 
//! Backend service for the Etched certificate SBT platform.
//! Provides authentication, validator management, certificate pools,
//! and certificate minting workflows.

mod config;
mod db;
mod errors;
mod handlers;
mod middleware;
mod models;
mod state;

use actix_cors::Cors;
use actix_web::{get, web::Data, App, HttpResponse, HttpServer, Responder};

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
    let bind_addr = config.bind_addr.clone();

    // Initialize state with database
    let state = AppState::new(config).await;

    // Initialize database schema
    db::init_db(&state.db).await.expect("Failed to initialize database");

    println!("🚀 Etched Backend starting...");
    println!("   Bind address: http://{}", bind_addr);
    println!("   Admin wallet: {}", state.config.admin_wallet);
    println!("   Pool cost: {} ETH", state.config.pool_cost_eth);

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
            .service(handlers::login)
            .service(handlers::register)
            .service(handlers::get_nonce)
            .service(handlers::verify_wallet)
            .service(handlers::get_me)
            .service(handlers::connect_wallet)
            // Admin endpoints
            .service(handlers::list_validator_requests)
            .service(handlers::decide_validator_request)
            .service(handlers::list_validators)
            .service(handlers::admin_stats)
            // Pool endpoints
            .service(handlers::pool_info)
            .service(handlers::create_pool)
            .service(handlers::get_pool)
            .service(handlers::my_pools)
            .service(handlers::toggle_pool)
            // Certificate endpoints
            .service(handlers::submit_certificate)
            .service(handlers::list_pool_certificates)
            .service(handlers::decide_certificate)
            .service(handlers::my_certificates)
            .service(handlers::verify_certificate)
            .service(handlers::public_stats)
    })
    .bind(&bind_addr)?
    .run()
    .await
}
