//! Application state and storage

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};

use crate::config::Config;
use crate::models::{RequestRecord, ValidatorProfile};

/// In-memory data store
#[derive(Default)]
pub struct Store {
    pub nonces: HashMap<String, String>,
    pub validators: HashMap<String, ValidatorProfile>,
    pub requests: HashMap<String, RequestRecord>,
    pub admins: HashSet<String>,
}

impl Store {
    /// Create store with admin addresses from config
    pub fn with_admins(admins: HashSet<String>) -> Self {
        Self {
            admins,
            ..Default::default()
        }
    }
}

/// Shared application state
#[derive(Clone)]
pub struct AppState {
    pub store: Arc<Mutex<Store>>,
    pub config: Config,
}

impl AppState {
    /// Create new application state
    pub fn new(config: Config) -> Self {
        let store = Store::with_admins(config.admin_addresses.clone());
        Self {
            store: Arc::new(Mutex::new(store)),
            config,
        }
    }

    /// Resolve user role based on address
    pub fn resolve_role(&self, address: &str) -> String {
        let store = self.store.lock().unwrap();
        
        if store.admins.contains(address) {
            return "admin".into();
        }
        if store.validators.contains_key(address) {
            return "validator".into();
        }
        "certificator".into()
    }
}
