//! Application state

use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Mutex;

use crate::config::Config;

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub db: PgPool,
    pub nonces: std::sync::Arc<Mutex<HashMap<String, String>>>,
}

impl AppState {
    pub async fn new(config: Config) -> Self {
        let db = PgPoolOptions::new()
            .max_connections(10)
            .connect(&config.database_url)
            .await
            .expect("Failed to connect to database");

        Self {
            config,
            db,
            nonces: std::sync::Arc::new(Mutex::new(HashMap::new())),
        }
    }
}
