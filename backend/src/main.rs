mod config;
mod db;
mod errors;
mod handlers;
mod middleware;
mod models;
mod state;

#[cfg(test)]
mod tests;

use actix_cors::Cors;
use actix_web::{get, web::Data, App, HttpResponse, HttpServer, Responder};

use config::Config;
use state::AppState;

#[get("/health")]
async fn health() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION")
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let config = Config::from_env();
    let bind_addr = config.bind_addr.clone();

    let state = AppState::new(config).await;

    db::init_db(&state.db)
        .await
        .expect("Failed to initialize database");

    println!("   Etched Backend starting...");
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
            .service(health)
            .service(handlers::login)
            .service(handlers::register)
            .service(handlers::get_nonce)
            .service(handlers::verify_wallet)
            .service(handlers::get_me)
            .service(handlers::connect_wallet)
            .service(handlers::list_validator_requests)
            .service(handlers::decide_validator_request)
            .service(handlers::list_validators)
            .service(handlers::admin_stats)
            .service(handlers::pool_info)
            .service(handlers::my_pools)
            .service(handlers::create_pool)
            .service(handlers::toggle_pool)
            .service(handlers::get_pool)
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
