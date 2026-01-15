const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

// ============ Auth - Email/Password ============

export async function login(email: string, password: string) {
  const res = await fetch(`${apiBase}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Login failed");
  }
  return res.json();
}

export async function registerValidator(payload: {
  email: string;
  password: string;
  username: string;
  institution_name: string;
  institution_id: string;
  document_url?: string;
}) {
  const res = await fetch(`${apiBase}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Registration failed");
  }
  return res.json();
}

export async function getMe(token: string) {
  const res = await fetch(`${apiBase}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to get profile");
  return res.json();
}

export async function connectWallet(token: string, walletAddress: string) {
  const res = await fetch(`${apiBase}/auth/connect-wallet`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ wallet_address: walletAddress })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to connect wallet");
  }
  return res.json();
}

// ============ Auth - Wallet (Certificator) ============

export async function getNonce(address: string) {
  const res = await fetch(`${apiBase}/auth/nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address })
  });
  if (!res.ok) throw new Error("Failed to get nonce");
  return res.json();
}

export async function verifyWallet(address: string, signature: string) {
  const res = await fetch(`${apiBase}/auth/verify-wallet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, signature })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Verification failed");
  }
  return res.json();
}

// ============ Admin ============

export async function listValidatorRequests(token: string) {
  const res = await fetch(`${apiBase}/admin/validator-requests`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to load requests");
  return res.json();
}

export async function decideValidatorRequest(token: string, id: number, approve: boolean, reason?: string) {
  const res = await fetch(`${apiBase}/admin/validator-requests/${id}/decision`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ approve, rejection_reason: reason })
  });
  if (!res.ok) throw new Error("Failed to process request");
  return res.json();
}

export async function listValidators(token: string) {
  const res = await fetch(`${apiBase}/admin/validators`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to load validators");
  return res.json();
}

export async function adminStats(token: string) {
  const res = await fetch(`${apiBase}/admin/stats`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to load stats");
  return res.json();
}

// ============ Pools ============

export async function getPoolInfo() {
  const res = await fetch(`${apiBase}/pools/info`);
  if (!res.ok) throw new Error("Failed to load pool info");
  return res.json();
}

export async function createPool(token: string, payload: {
  name: string;
  description?: string;
  tx_hash: string;
}) {
  const res = await fetch(`${apiBase}/pools`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to create pool");
  }
  return res.json();
}

export async function getPool(code: string) {
  const res = await fetch(`${apiBase}/pools/${code}`);
  if (!res.ok) throw new Error("Pool not found");
  return res.json();
}

export async function myPools(token: string) {
  const res = await fetch(`${apiBase}/pools/my`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to load pools");
  return res.json();
}

export async function togglePool(token: string, poolId: number) {
  const res = await fetch(`${apiBase}/pools/${poolId}/toggle`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to toggle pool");
  return res.json();
}

// ============ Certificates ============

export async function submitCertificate(token: string, poolCode: string, payload: {
  recipient_name: string;
  recipient_wallet: string;
  certificate_type: string;
  document_hash: string;
  metadata_uri?: string;
}) {
  const res = await fetch(`${apiBase}/pools/${poolCode}/certificates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to submit certificate");
  }
  return res.json();
}

export async function listPoolCertificates(token: string, poolCode: string, status?: string) {
  const url = status
    ? `${apiBase}/pools/${poolCode}/certificates?status=${status}`
    : `${apiBase}/pools/${poolCode}/certificates`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to load certificates");
  return res.json();
}

export async function decideCertificate(token: string, certId: number, payload: {
  approve: boolean;
  tx_hash?: string;
  token_id?: number;
  rejection_reason?: string;
}) {
  const res = await fetch(`${apiBase}/certificates/${certId}/decision`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to process decision");
  }
  return res.json();
}

export async function myCertificates(token: string) {
  const res = await fetch(`${apiBase}/certificates/my`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to load certificates");
  return res.json();
}

export async function verifyCertificate(hash: string) {
  const res = await fetch(`${apiBase}/certificates/verify/${hash}`);
  if (!res.ok) throw new Error("Verification failed");
  return res.json();
}

// ============ Public Stats ============

export async function publicStats() {
  const res = await fetch(`${apiBase}/stats`);
  if (!res.ok) throw new Error("Failed to load stats");
  return res.json();
}
