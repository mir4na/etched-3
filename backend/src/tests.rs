
#[cfg(test)]
mod tests {
    use super::*;
    
    mod config_tests {
        use crate::config::Config;
        use std::env;

        #[test]
        fn test_config_lifecycle() {
            // Run sequentially to avoid env var race conditions
            
            // 1. Test Defaults (forced to specific values to avoid .env interference)
            env::set_var("DATABASE_URL", "postgres://test:test@localhost/test");
            env::set_var("JWT_SECRET", "forced-default-secret");
            env::set_var("ADMIN_WALLET", "0xdefault");
            env::set_var("BIND_ADDR", "0.0.0.0:8080");
            env::set_var("POOL_COST_ETH", "0.1");
            
            let config = Config::from_env();
            assert_eq!(config.jwt_secret, "forced-default-secret");
            assert_eq!(config.bind_addr, "0.0.0.0:8080");
            assert_eq!(config.pool_cost_eth, 0.1);

            // 2. Test Custom Env
            env::set_var("JWT_SECRET", "test-secret-custom");
            env::set_var("ADMIN_WALLET", "0xadmin");
            env::set_var("BIND_ADDR", "127.0.0.1:9999");
            env::set_var("POOL_COST_ETH", "0.5");
            
            let config2 = Config::from_env();
            assert_eq!(config2.jwt_secret, "test-secret-custom");
            assert_eq!(config2.bind_addr, "127.0.0.1:9999");
            assert_eq!(config2.admin_wallet, "0xadmin");
            assert_eq!(config2.pool_cost_eth, 0.5);
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
        fn test_verify_wallet_request_deserialize() {
            let json = r#"{"address": "0x123", "signature": "0xsig"}"#;
            let req: VerifyWalletRequest = serde_json::from_str(json).unwrap();
            assert_eq!(req.address, "0x123");
            assert_eq!(req.signature, "0xsig");
        }

        #[test]
        fn test_register_request() {
            let json = r#"{
                "email": "test@test.com",
                "password": "pass",
                "username": "user",
                "institution_name": "Test University",
                "institution_id": "INST-001"
            }"#;
            let req: RegisterRequest = serde_json::from_str(json).unwrap();
            assert_eq!(req.institution_id, "INST-001");
            assert_eq!(req.email, "test@test.com");
        }

        #[test]
        fn test_submit_certificate_request() {
            let json = r#"{
                "recipient_name": "John Doe",
                "recipient_wallet": "0xrecipient",
                "certificate_type": "diploma",
                "document_hash": "0xhash",
                "metadata_uri": "http://ipfs.io/ipfs/Qm..."
            }"#;
            let req: SubmitCertificateRequest = serde_json::from_str(json).unwrap();
            assert_eq!(req.certificate_type, "diploma");
            assert_eq!(req.document_hash, "0xhash");
        }

        #[test]
        fn test_certificate_decision_request() {
            let json = r#"{"approve": true, "tx_hash": "0xtx", "token_id": 1}"#;
            let req: CertificateDecisionRequest = serde_json::from_str(json).unwrap();
            assert_eq!(req.approve, true);
            assert_eq!(req.tx_hash, Some("0xtx".to_string()));
            assert_eq!(req.token_id, Some(1));
        }

        #[test]
        fn test_claims_serialize() {
            let claims = Claims {
                sub: "123".to_string(), // user id as string
                role: "admin".to_string(),
                auth_type: "email".to_string(),
                exp: 1234567890,
            };
            let json = serde_json::to_string(&claims).unwrap();
            assert!(json.contains("admin"));
            assert!(json.contains("email"));
        }
    }
}
