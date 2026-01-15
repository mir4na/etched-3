const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

export async function getNonce(address: string) {
  const res = await fetch(`${apiBase}/auth/nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address })
  });
  if (!res.ok) {
    throw new Error("Failed to get nonce");
  }
  return res.json();
}

export async function verifySignature(address: string, signature: string) {
  const res = await fetch(`${apiBase}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, signature })
  });
  if (!res.ok) {
    throw new Error("Signature invalid");
  }
  return res.json();
}

export async function createMetadata(token: string, payload: Record<string, unknown>) {
  const res = await fetch(`${apiBase}/metadata`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    throw new Error("Failed to create metadata");
  }
  return res.json();
}

export async function createRequest(token: string, payload: Record<string, unknown>) {
  const res = await fetch(`${apiBase}/requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    throw new Error("Failed to create request");
  }
  return res.json();
}

export async function addValidator(token: string, payload: Record<string, unknown>) {
  const res = await fetch(`${apiBase}/admin/validators`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    throw new Error("Failed to add validator");
  }
  return res.json();
}

export async function listValidators() {
  const res = await fetch(`${apiBase}/validators`);
  if (!res.ok) {
    throw new Error("Failed to load validators");
  }
  return res.json();
}
