# Deployment Guide

This guide explains how to deploy the **Etched** application stack using Docker Compose.

## Prerequisites
-   [Docker](https://docs.docker.com/get-docker/) installed and running.
-   [Docker Compose](https://docs.docker.com/compose/install/) (included in Docker Desktop).

## Configuration

1.  **Create an Environment File**
    Create a `.env` file in the root directory (where `docker-compose.yml` is located).
    
    ```bash
    # .env
    
    # Security
    JWT_SECRET=production_secret_key_change_this
    ADMIN_WALLET=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 
    
    # Blockchain
    # NOTE: You must deploy the contract first to get this address.
    CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
    ```

2.  **Verify Backend Config**
    The backend connects to a PostgreSQL database managed by Docker. No manual DB setup is required; the application automatically initializes the schema on startup (`db::init_db`).

## Running the Application

1.  **Build and Start**
    Run the following command to build images and start services in the background:
    
    ```bash
    docker-compose up --build -d
    ```

2.  **Check Status**
    Verify that all containers are running:
    
    ```bash
    docker-compose ps
    ```
    You should see `frontend`, `backend`, `db`, and `hardhat` services as `Up`.

3.  **Logs**
    If something isn't modifying, check the logs (e.g., for backend):
    
    ```bash
    docker-compose logs -f backend
    ```

## Access Points

| Service | URL | Description |
| :--- | :--- | :--- |
| **Frontend** | [http://localhost:3000](http://localhost:3000) | Main User Interface |
| **Backend API** | [http://localhost:8080](http://localhost:8080) | REST API & Swagger (if enabled) |
| **Blockchain** | [http://localhost:8545](http://localhost:8545) | Local Hardhat Network |
| **Database** | `localhost:5432` | PostgreSQL (user: `etched`, pass: `password`) |

## Troubleshooting

-   **Backend Fails to Connect to DB**: Ensure the `db` service is healthy. The `depends_on` condition waits for it to start, but initialization might take a few seconds. Restarting the backend (`docker-compose restart backend`) often fixes this.
-   **Frontend "Contract Not Found"**: Ensure `CONTRACT_ADDRESS` in `.env` matches the deployed contract on the Hardhat network. The frontend Environment Variables are baked in at **Build Time**, so if you change text in `.env`, you must rebuild:
    ```bash
    docker-compose up --build -d frontend
    ```
