//! Database initialization and migrations

use sqlx::PgPool;

/// Initialize database schema
pub async fn init_db(pool: &PgPool) -> Result<(), sqlx::Error> {
    // Create tables
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            username VARCHAR(100) NOT NULL,
            role VARCHAR(20) NOT NULL DEFAULT 'validator',
            wallet_address VARCHAR(42),
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    "#)
    .execute(pool)
    .await?;

    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS validator_requests (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            institution_name VARCHAR(255) NOT NULL,
            institution_id VARCHAR(100) NOT NULL,
            document_url TEXT,
            status VARCHAR(20) DEFAULT 'pending',
            reviewed_by INTEGER REFERENCES users(id),
            reviewed_at TIMESTAMPTZ,
            rejection_reason TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    "#)
    .execute(pool)
    .await?;

    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS pools (
            id SERIAL PRIMARY KEY,
            code VARCHAR(20) UNIQUE NOT NULL,
            validator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            tx_hash VARCHAR(66),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    "#)
    .execute(pool)
    .await?;

    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS certificates (
            id SERIAL PRIMARY KEY,
            pool_id INTEGER REFERENCES pools(id) ON DELETE CASCADE,
            certificator_wallet VARCHAR(42) NOT NULL,
            recipient_name VARCHAR(255) NOT NULL,
            recipient_wallet VARCHAR(42) NOT NULL,
            certificate_type VARCHAR(100) NOT NULL,
            document_hash VARCHAR(66) NOT NULL,
            metadata_uri TEXT,
            status VARCHAR(20) DEFAULT 'pending',
            token_id INTEGER,
            tx_hash VARCHAR(66),
            validated_at TIMESTAMPTZ,
            minted_at TIMESTAMPTZ,
            rejection_reason TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    "#)
    .execute(pool)
    .await?;

    // Seed admin user if not exists
    let admin_exists: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM users WHERE email = 'admin@admin.com'"
    )
    .fetch_one(pool)
    .await?;

    if admin_exists.0 == 0 {
        // Hash: "admin123" with bcrypt
        let password_hash = bcrypt::hash("admin123", bcrypt::DEFAULT_COST)
            .expect("Failed to hash password");

        sqlx::query(r#"
            INSERT INTO users (email, password_hash, username, role)
            VALUES ('admin@admin.com', $1, 'admin', 'admin')
        "#)
        .bind(&password_hash)
        .execute(pool)
        .await?;

        println!("✅ Admin user seeded: admin@admin.com / admin123");
    }

    Ok(())
}
