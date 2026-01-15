//! API Handlers module

pub mod auth;
pub mod metadata;
pub mod requests;
pub mod validators;

// Re-export all handlers for convenience
pub use auth::{get_profile, issue_nonce, verify_signature};
pub use metadata::{create_metadata, get_metadata};
pub use requests::{create_request, decide_request, get_request, list_requests, my_requests};
pub use validators::{add_validator, get_validator, list_validators, remove_validator};
