//! Backend configuration module

use std::collections::HashSet;

/// Application configuration loaded from environment
#[derive(Clone)]
pub struct Config {
    pub jwt_secret: String,
    pub admin_addresses: HashSet<String>,
    pub bind_addr: String,
    pub public_base_url: String,
    pub metadata_dir: String,
}

impl Config {
    /// Load configuration from environment variables
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        let jwt_secret = std::env::var("JWT_SECRET")
            .unwrap_or_else(|_| "super-secret".into());
        
        let admin_env = std::env::var("ADMIN_ADDRESSES").unwrap_or_default();
        let admin_addresses: HashSet<String> = admin_env
            .split(',')
            .filter(|s| !s.trim().is_empty())
            .map(|s| s.trim().to_lowercase())
            .collect();

        let bind_addr = std::env::var("BIND_ADDR")
            .unwrap_or_else(|_| "0.0.0.0:8080".into());

        let public_base_url = std::env::var("PUBLIC_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:8080".into());

        let metadata_dir = std::env::var("METADATA_DIR")
            .unwrap_or_else(|_| "./data/metadata".into());

        Self {
            jwt_secret,
            admin_addresses,
            bind_addr,
            public_base_url,
            metadata_dir,
        }
    }
}
