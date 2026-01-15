//! Unit tests for the Etched backend

#[cfg(test)]
mod tests {
    use super::*;
    
    mod config_tests {
        use crate::config::Config;
        use std::env;

        #[test]
        fn test_config_defaults() {
            // Clear env vars for test
            env::remove_var("JWT_SECRET");
            env::remove_var("ADMIN_ADDRESSES");
            env::remove_var("BIND_ADDR");
            
            let config = Config::from_env();
            
            assert_eq!(config.jwt_secret, "super-secret");
            assert_eq!(config.bind_addr, "0.0.0.0:8080");
            assert!(config.admin_addresses.is_empty());
        }

        #[test]
        fn test_config_from_env() {
            env::set_var("JWT_SECRET", "test-secret");
            env::set_var("ADMIN_ADDRESSES", "0xabc,0xdef");
            env::set_var("BIND_ADDR", "127.0.0.1:9000");
            
            let config = Config::from_env();
            
            assert_eq!(config.jwt_secret, "test-secret");
            assert_eq!(config.bind_addr, "127.0.0.1:9000");
            assert!(config.admin_addresses.contains("0xabc"));
            assert!(config.admin_addresses.contains("0xdef"));
            
            // Cleanup
            env::remove_var("JWT_SECRET");
            env::remove_var("ADMIN_ADDRESSES");
            env::remove_var("BIND_ADDR");
        }
    }

    mod state_tests {
        use crate::config::Config;
        use crate::state::AppState;
        use std::collections::HashSet;

        fn create_test_state() -> AppState {
            let mut admins = HashSet::new();
            admins.insert("0xadmin".to_string());
            
            let config = Config {
                jwt_secret: "test".to_string(),
                admin_addresses: admins,
                bind_addr: "0.0.0.0:8080".to_string(),
                public_base_url: "http://localhost:8080".to_string(),
                metadata_dir: "./test_data".to_string(),
            };
            
            AppState::new(config)
        }

        #[test]
        fn test_resolve_role_admin() {
            let state = create_test_state();
            assert_eq!(state.resolve_role("0xadmin"), "admin");
        }

        #[test]
        fn test_resolve_role_certificator() {
            let state = create_test_state();
            assert_eq!(state.resolve_role("0xunknown"), "certificator");
        }

        #[test]
        fn test_resolve_role_validator() {
            use crate::models::ValidatorProfile;
            use chrono::Utc;
            
            let state = create_test_state();
            
            // Add validator
            {
                let mut store = state.store.lock().unwrap();
                store.validators.insert(
                    "0xvalidator".to_string(),
                    ValidatorProfile {
                        address: "0xvalidator".to_string(),
                        institution_id: "INST-001".to_string(),
                        institution_name: "Test Uni".to_string(),
                        verified_at: Utc::now(),
                    }
                );
            }
            
            assert_eq!(state.resolve_role("0xvalidator"), "validator");
        }
    }

    mod models_tests {
        use crate::models::*;

        #[test]
        fn test_nonce_request_deserialize() {
            let json = r#"{"address": "0x123"}"#;
            let req: NonceRequest = serde_json::from_str(json).unwrap();
            assert_eq!(req.address, "0x123");
        }

        #[test]
        fn test_verify_request_deserialize() {
            let json = r#"{"address": "0x123", "signature": "0xsig"}"#;
            let req: VerifyRequest = serde_json::from_str(json).unwrap();
            assert_eq!(req.address, "0x123");
            assert_eq!(req.signature, "0xsig");
        }

        #[test]
        fn test_validator_create_request() {
            let json = r#"{
                "address": "0x123",
                "institution_id": "INST-001",
                "institution_name": "Test University"
            }"#;
            let req: ValidatorCreateRequest = serde_json::from_str(json).unwrap();
            assert_eq!(req.institution_id, "INST-001");
        }

        #[test]
        fn test_request_create_payload() {
            let json = r#"{
                "recipient": "0xrecipient",
                "certificate_hash": "0xhash",
                "metadata_uri": "http://example.com/meta.json",
                "institution_id": "INST-001",
                "certificate_type": "diploma"
            }"#;
            let req: RequestCreatePayload = serde_json::from_str(json).unwrap();
            assert_eq!(req.certificate_type, "diploma");
        }

        #[test]
        fn test_decision_payload() {
            let json = r#"{"status": "approved", "reason": "Valid"}"#;
            let req: DecisionPayload = serde_json::from_str(json).unwrap();
            assert_eq!(req.status, "approved");
            assert_eq!(req.reason, Some("Valid".to_string()));
        }

        #[test]
        fn test_metadata_payload() {
            let json = r#"{
                "certificate_name": "Bachelor Degree",
                "recipient_name": "John Doe",
                "recipient_address": "0xjohn",
                "institution_id": "INST-001",
                "institution_name": "Test University",
                "certificate_type": "diploma",
                "issued_at": "2024-01-15"
            }"#;
            let req: MetadataPayload = serde_json::from_str(json).unwrap();
            assert_eq!(req.certificate_name, "Bachelor Degree");
            assert!(req.details.is_none());
        }

        #[test]
        fn test_claims_serialize() {
            let claims = Claims {
                sub: "0x123".to_string(),
                role: "admin".to_string(),
                exp: 1234567890,
            };
            let json = serde_json::to_string(&claims).unwrap();
            assert!(json.contains("0x123"));
        }
    }

    mod errors_tests {
        use crate::errors::ApiError;
        use actix_web::ResponseError;

        #[test]
        fn test_unauthorized_status() {
            let err = ApiError::Unauthorized;
            let resp = err.error_response();
            assert_eq!(resp.status().as_u16(), 401);
        }

        #[test]
        fn test_forbidden_status() {
            let err = ApiError::Forbidden;
            let resp = err.error_response();
            assert_eq!(resp.status().as_u16(), 403);
        }

        #[test]
        fn test_not_found_status() {
            let err = ApiError::NotFound;
            let resp = err.error_response();
            assert_eq!(resp.status().as_u16(), 404);
        }

        #[test]
        fn test_bad_request_status() {
            let err = ApiError::BadRequest("test error".into());
            let resp = err.error_response();
            assert_eq!(resp.status().as_u16(), 400);
        }

        #[test]
        fn test_internal_status() {
            let err = ApiError::Internal;
            let resp = err.error_response();
            assert_eq!(resp.status().as_u16(), 500);
        }
    }
}
