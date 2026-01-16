

use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub admin_wallet: String,
    pub bind_addr: String,
    pub pool_cost_eth: f64,
}

impl Config {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        Self {
            database_url: env::var("DATABASE_URL")
                .expect("DATABASE_URL must be set"),
            jwt_secret: env::var("JWT_SECRET")
                .unwrap_or_else(|_| "etched-dev-secret-change-in-production".into()),
            admin_wallet: env::var("ADMIN_WALLET")
                .unwrap_or_else(|_| "0x0000000000000000000000000000000000000000".into()),
            bind_addr: env::var("BIND_ADDR")
                .unwrap_or_else(|_| "0.0.0.0:8080".into()),
            pool_cost_eth: env::var("POOL_COST_ETH")
                .unwrap_or_else(|_| "0.1".into())
                .parse()
                .unwrap_or(0.1),
        }
    }
}
