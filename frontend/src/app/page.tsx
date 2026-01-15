"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ethers } from "ethers";
import { addValidator, createMetadata, createRequest, getNonce, listValidators, verifySignature } from "@/lib/api";
import { chainId, getContract } from "@/lib/contract";
import { ToastContainer, useToast } from "@/components/Toast";
import { Spinner } from "@/components/Spinner";

type RequestOnChain = {
  requestId: bigint;
  certificator: string;
  recipient: string;
  certificateHash: string;
  metadataURI: string;
  institutionId: string;
  certificateType: string;
  status: bigint;
  createdAt: bigint;
  validatedAt: bigint;
  validatedBy: string;
  rejectionReason: string;
};

type ValidatorProfile = {
  address: string;
  institution_id: string;
  institution_name: string;
  verified_at: string;
};

const STATUS_LABELS: Record<number, string> = {
  0: "Pending",
  1: "Approved",
  2: "Rejected",
  3: "Minted"
};

export default function Home() {
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [networkId, setNetworkId] = useState<number | null>(null);
  const [roleTab, setRoleTab] = useState<"certificator" | "validator" | "admin">("certificator");
  const [token, setToken] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [rejectModalId, setRejectModalId] = useState<bigint | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [requests, setRequests] = useState<RequestOnChain[]>([]);
  const [validators, setValidators] = useState<ValidatorProfile[]>([]);

  const { toasts, addToast, removeToast } = useToast();

  const provider = useMemo(() => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      return null;
    }
    return new ethers.BrowserProvider((window as any).ethereum);
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("etched_token");
    const storedRole = window.localStorage.getItem("etched_role");
    if (stored) {
      setToken(stored);
    }
    if (storedRole) {
      setRole(storedRole);
    }
  }, []);

  useEffect(() => {
    if (!provider) {
      return;
    }
    provider.getNetwork().then((net) => setNetworkId(Number(net.chainId))).catch(() => undefined);
  }, [provider]);

  const connectWallet = async () => {
    if (!provider) {
      addToast("MetaMask not detected. Please install MetaMask.", "error");
      return;
    }
    try {
      const accounts = await provider.send("eth_requestAccounts", []);
      setWalletAddress(accounts[0]);
      const network = await provider.getNetwork();
      setNetworkId(Number(network.chainId));
      addToast("Wallet connected successfully!", "success");
    } catch {
      addToast("Failed to connect wallet.", "error");
    }
  };

  const signIn = async () => {
    if (!provider || !walletAddress) {
      addToast("Connect wallet first.", "warning");
      return;
    }
    setLoading(true);
    try {
      const { message } = await getNonce(walletAddress);
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(message);
      const result = await verifySignature(walletAddress, signature);
      setToken(result.token);
      setRole(result.role);
      window.localStorage.setItem("etched_token", result.token);
      window.localStorage.setItem("etched_role", result.role);
      addToast(`Signed in as ${result.role}.`, "success");
    } catch {
      addToast("Sign-in failed. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    setToken("");
    setRole("");
    window.localStorage.removeItem("etched_token");
    window.localStorage.removeItem("etched_role");
    addToast("Signed out successfully.", "info");
  };

  const loadRequests = async () => {
    if (!provider) {
      return;
    }
    try {
      const contract = getContract(provider);
      const total = await contract.totalRequests();
      const entries: RequestOnChain[] = [];
      for (let i = 1; i <= Number(total); i += 1) {
        const req = await contract.getCertificateRequest(i);
        entries.push(req as RequestOnChain);
      }
      setRequests(entries);
    } catch {
      // Silent fail on initial load
    }
  };

  const loadValidators = async () => {
    try {
      const result = await listValidators();
      setValidators(result);
    } catch {
      // Silent fail
    }
  };

  useEffect(() => {
    loadRequests();
    loadValidators();
  }, [provider]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast("Copied to clipboard!", "success");
  };

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!provider || !walletAddress) {
      addToast("Connect wallet first.", "warning");
      return;
    }
    if (!token) {
      addToast("Sign in before submitting.", "warning");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const recipient = String(formData.get("recipient"));
    const recipientName = String(formData.get("recipientName"));
    const certificateName = String(formData.get("certificateName"));
    const institutionId = String(formData.get("institutionId"));
    const institutionName = String(formData.get("institutionName"));
    const certificateType = String(formData.get("certificateType"));
    const issuedAt = String(formData.get("issuedAt"));
    const details = String(formData.get("details"));

    if (!recipient || !certificateName || !institutionId) {
      addToast("Please complete all required fields.", "warning");
      return;
    }

    setLoading(true);
    try {
      const metadata = await createMetadata(token, {
        certificate_name: certificateName,
        recipient_name: recipientName,
        recipient_address: recipient,
        institution_id: institutionId,
        institution_name: institutionName,
        certificate_type: certificateType,
        issued_at: issuedAt,
        details
      });

      const payloadHash = ethers.keccak256(
        ethers.toUtf8Bytes(
          JSON.stringify({
            recipient,
            certificateName,
            institutionId,
            certificateType,
            issuedAt,
            metadata: metadata.uri
          })
        )
      );

      const signer = await provider.getSigner();
      const contract = getContract(signer);
      const tx = await contract.submitCertificateRequest(
        recipient,
        payloadHash,
        metadata.uri,
        institutionId,
        certificateType
      );
      const receipt = await tx.wait();

      await createRequest(token, {
        recipient,
        certificate_hash: payloadHash,
        metadata_uri: metadata.uri,
        institution_id: institutionId,
        certificate_type: certificateType
      });

      const requestEvent = receipt?.logs
        ?.map((log: any) => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed: any) => parsed?.name === "CertificateRequested");

      const requestId = requestEvent?.args?.requestId?.toString();
      addToast(`Request submitted! ID: ${requestId ?? "unknown"}`, "success");
      loadRequests();
      event.currentTarget.reset();
    } catch (error: any) {
      addToast(error?.reason || "Failed to submit request.", "error");
    } finally {
      setLoading(false);
    }
  };

  const approveRequest = async (requestId: bigint) => {
    if (!provider) {
      return;
    }
    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const contract = getContract(signer);
      const tx = await contract.approveCertificate(requestId);
      await tx.wait();
      addToast(`Request #${requestId.toString()} approved and SBT minted!`, "success");
      loadRequests();
    } catch (error: any) {
      addToast(error?.reason || "Approval failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const rejectRequest = async () => {
    if (!provider || !rejectModalId) {
      return;
    }
    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const contract = getContract(signer);
      const tx = await contract.rejectCertificate(rejectModalId, rejectReason || "Rejected by validator");
      await tx.wait();
      addToast(`Request #${rejectModalId.toString()} rejected.`, "info");
      loadRequests();
      setRejectModalId(null);
      setRejectReason("");
    } catch (error: any) {
      addToast(error?.reason || "Rejection failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const submitValidator = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!provider || !token) {
      addToast("Sign in as admin first.", "warning");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const validatorAddress = String(formData.get("validatorAddress"));
    const institutionId = String(formData.get("institutionId"));
    const institutionName = String(formData.get("institutionName"));

    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const contract = getContract(signer);
      const tx = await contract.addValidator(validatorAddress, institutionId, institutionName);
      await tx.wait();
      await addValidator(token, {
        address: validatorAddress,
        institution_id: institutionId,
        institution_name: institutionName
      });
      addToast("Validator added on-chain and registered!", "success");
      loadValidators();
      event.currentTarget.reset();
    } catch (error: any) {
      addToast(error?.reason || "Failed to add validator.", "error");
    } finally {
      setLoading(false);
    }
  };

  const verifyHash = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!provider) {
      addToast("Connect wallet first.", "warning");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const certHash = String(formData.get("certificateHash"));
    setLoading(true);
    try {
      const contract = getContract(provider);
      const result = await contract.verifyCertificateByHash(certHash);
      if (result[0]) {
        addToast(`✓ Valid! Token #${result[1].toString()} for ${result[2].slice(0, 10)}...`, "success");
      } else {
        addToast("Hash not found on-chain.", "warning");
      }
    } catch {
      addToast("Verification failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const pendingRequests = requests.filter((req) => req.status === 0n);
  const mintedRequests = requests.filter((req) => req.status === 3n);

  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <main>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <section className="hero">
        <div className="hero-card">
          <span className="badge">Etched · Soulbound Certificates</span>
          <h1>Mint tamper-proof diplomas and certificates.</h1>
          <p>
            A Web3 platform for issuing academic credentials as Soulbound Tokens.
            Verified by institutions, immutable on blockchain.
          </p>
          <div className="stats">
            <div className="stat">
              <span>Total Requests</span>
              <strong>{requests.length}</strong>
            </div>
            <div className="stat">
              <span>Minted SBTs</span>
              <strong>{mintedRequests.length}</strong>
            </div>
            <div className="stat">
              <span>Validators</span>
              <strong>{validators.length}</strong>
            </div>
          </div>
        </div>
        <div className="hero-card">
          <h2>🔗 Wallet Connection</h2>
          <p className="small">Connect your wallet to access role-specific features.</p>
          <div className="panel">
            <div className="panel-row">
              <span className="small">Address</span>
              <strong className="mono">{walletAddress ? shortenAddress(walletAddress) : "Not connected"}</strong>
            </div>
            <div className="panel-row">
              <span className="small">Network</span>
              <strong>{networkId ?? "—"}</strong>
              {chainId !== 0 && networkId !== null && networkId !== chainId && (
                <span className="badge warning">Wrong network</span>
              )}
            </div>
            <div className="panel-row">
              <span className="small">Role</span>
              <span className={`role-badge ${role || "guest"}`}>{role || "guest"}</span>
            </div>
            <div className="actions">
              <button className="button" onClick={connectWallet} disabled={loading}>
                {loading ? <Spinner size="sm" /> : "Connect"}
              </button>
              <button className="button secondary" onClick={signIn} disabled={loading || !walletAddress}>
                {loading ? <Spinner size="sm" /> : "Sign In"}
              </button>
              <button className="button ghost" onClick={signOut} disabled={!token}>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-card">
          <h2>📋 Role Workflow</h2>
          <p>
            Select your role to access corresponding features.
          </p>
          <div className="tabs">
            {(["certificator", "validator", "admin"] as const).map((tab) => (
              <button
                key={tab}
                className={`tab ${roleTab === tab ? "active" : ""}`}
                onClick={() => setRoleTab(tab)}
              >
                {tab === "certificator" && "📄 "}
                {tab === "validator" && "✅ "}
                {tab === "admin" && "👤 "}
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {roleTab === "certificator" && (
            <form className="form" onSubmit={submitRequest}>
              <div className="form-grid">
                <div className="field">
                  <label>Recipient Address *</label>
                  <input name="recipient" placeholder="0x..." required />
                </div>
                <div className="field">
                  <label>Recipient Name</label>
                  <input name="recipientName" placeholder="Full name" />
                </div>
                <div className="field full">
                  <label>Certificate Name *</label>
                  <input name="certificateName" placeholder="Bachelor of Computer Science" required />
                </div>
                <div className="field">
                  <label>Institution ID *</label>
                  <input name="institutionId" placeholder="UNIV-001" required />
                </div>
                <div className="field">
                  <label>Institution Name</label>
                  <input name="institutionName" placeholder="University Name" />
                </div>
                <div className="field">
                  <label>Type</label>
                  <select name="certificateType" defaultValue="diploma">
                    <option value="diploma">Diploma</option>
                    <option value="certificate">Certificate</option>
                    <option value="badge">Badge</option>
                  </select>
                </div>
                <div className="field">
                  <label>Issued Date *</label>
                  <input name="issuedAt" type="date" required />
                </div>
                <div className="field full">
                  <label>Details / Notes</label>
                  <textarea name="details" placeholder="Additional information (GPA, honors, etc.)" />
                </div>
              </div>
              <div className="actions">
                <button className="button" type="submit" disabled={loading}>
                  {loading ? <Spinner size="sm" /> : "Submit Request"}
                </button>
              </div>
            </form>
          )}

          {roleTab === "validator" && (
            <div className="list">
              {pendingRequests.length === 0 && (
                <div className="empty-state">
                  <span>✓</span>
                  <p>No pending requests</p>
                </div>
              )}
              {pendingRequests.map((req) => (
                <div className="list-item" key={req.requestId.toString()}>
                  <div className="list-item-header">
                    <strong>Request #{req.requestId.toString()}</strong>
                    <span className="badge">{STATUS_LABELS[Number(req.status)]}</span>
                  </div>
                  <div className="list-item-details">
                    <div className="detail-row">
                      <span>Recipient</span>
                      <code onClick={() => copyToClipboard(req.recipient)}>{shortenAddress(req.recipient)}</code>
                    </div>
                    <div className="detail-row">
                      <span>Institution</span>
                      <code>{req.institutionId}</code>
                    </div>
                    <div className="detail-row">
                      <span>Type</span>
                      <code>{req.certificateType}</code>
                    </div>
                    <div className="detail-row">
                      <span>Hash</span>
                      <code onClick={() => copyToClipboard(req.certificateHash)} className="hash">
                        {req.certificateHash.slice(0, 20)}...
                      </code>
                    </div>
                  </div>
                  <div className="actions">
                    <button
                      className="button"
                      onClick={() => approveRequest(req.requestId)}
                      disabled={loading}
                    >
                      {loading ? <Spinner size="sm" /> : "✓ Approve & Mint"}
                    </button>
                    <button
                      className="button ghost"
                      onClick={() => setRejectModalId(req.requestId)}
                      disabled={loading}
                    >
                      ✕ Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {roleTab === "admin" && (
            <>
              <form className="form" onSubmit={submitValidator}>
                <div className="form-grid">
                  <div className="field full">
                    <label>Validator Wallet Address *</label>
                    <input name="validatorAddress" placeholder="0x..." required />
                  </div>
                  <div className="field">
                    <label>Institution ID *</label>
                    <input name="institutionId" placeholder="UNIV-001" required />
                  </div>
                  <div className="field">
                    <label>Institution Name *</label>
                    <input name="institutionName" placeholder="University Name" required />
                  </div>
                </div>
                <div className="actions">
                  <button className="button" type="submit" disabled={loading}>
                    {loading ? <Spinner size="sm" /> : "Add Validator"}
                  </button>
                </div>
              </form>
              <h3>Registered Validators</h3>
              <div className="list">
                {validators.length === 0 && (
                  <div className="empty-state">
                    <span>👤</span>
                    <p>No validators registered yet</p>
                  </div>
                )}
                {validators.map((validator) => (
                  <div className="list-item compact" key={validator.address}>
                    <div className="list-item-header">
                      <strong>{validator.institution_name}</strong>
                      <code className="small">{shortenAddress(validator.address)}</code>
                    </div>
                    <div className="small">ID: {validator.institution_id}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="section-card">
          <h2>🔍 Verify Certificate</h2>
          <p>Enter a certificate hash to verify its authenticity on-chain.</p>
          <form className="form" onSubmit={verifyHash}>
            <div className="field">
              <label>Certificate Hash</label>
              <input name="certificateHash" placeholder="0x..." required />
            </div>
            <div className="actions">
              <button className="button" type="submit" disabled={loading}>
                {loading ? <Spinner size="sm" /> : "Verify"}
              </button>
            </div>
          </form>

          <h3>Recent Minted Certificates</h3>
          <div className="list">
            {mintedRequests.length === 0 && (
              <div className="empty-state small">
                <span>📜</span>
                <p>No certificates minted yet</p>
              </div>
            )}
            {mintedRequests.slice(0, 5).map((req) => (
              <div className="list-item compact" key={req.requestId.toString()}>
                <div className="list-item-header">
                  <strong>Token #{req.requestId.toString()}</strong>
                  <span className="badge success">Minted</span>
                </div>
                <div className="small">
                  {shortenAddress(req.recipient)} · {req.institutionId} · {req.certificateType}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reject Modal */}
      {rejectModalId !== null && (
        <div className="modal-overlay" onClick={() => setRejectModalId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Reject Request #{rejectModalId.toString()}</h3>
            <div className="field">
              <label>Rejection Reason</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Provide a reason for rejection..."
              />
            </div>
            <div className="actions">
              <button className="button ghost" onClick={() => setRejectModalId(null)}>
                Cancel
              </button>
              <button className="button" onClick={rejectRequest} disabled={loading}>
                {loading ? <Spinner size="sm" /> : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="footer">
        <p>Etched · Web3 Credentialing Platform</p>
        <p className="small">Powered by Ethereum · Soulbound Tokens</p>
      </footer>
    </main>
  );
}
