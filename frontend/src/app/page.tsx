"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { ethers } from "ethers";
import * as api from "@/lib/api";
import { getContract } from "@/lib/contract";
import { ToastContainer, useToast } from "@/components/Toast";
import { uploadToIPFS } from "@/lib/ipfs";

// --- SVG ICONS ---
type IconProps = React.SVGProps<SVGSVGElement>;
const Icons = {
  Logo: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  Search: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>),
  File: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>),
  Check: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="20 6 9 17 4 12" /></svg>),
  X: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>),
  Plus: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>),
  Loader: (p: IconProps) => (<svg style={{ animation: 'spin 1.5s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>),
  Clock: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>),
  Wallet: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" /></svg>),
};

// --- TYPES ---
type Section = "home" | "login" | "register" | "dashboard" | "verify" | "certificator";
type Role = "" | "admin" | "validator" | "certificator";

// --- MAIN ---
export default function Home() {
  const [section, setSection] = useState<Section>("home");
  const [role, setRole] = useState<Role>("");
  const [token, setToken] = useState("");
  const [wallet, setWallet] = useState("");
  const [loading, setLoading] = useState(false);

  // User data
  const [userData, setUserData] = useState<any>(null);
  const [validatorRequest, setValidatorRequest] = useState<any>(null);
  const [stats, setStats] = useState({ total_validators: 0, total_pools: 0, total_certificates: 0 });

  // Admin data
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [validators, setValidators] = useState<any[]>([]);

  // Validator data
  const [myPools, setMyPools] = useState<any[]>([]);
  const [poolInfo, setPoolInfo] = useState<any>(null);

  // Certificator data
  const [myCertificates, setMyCertificates] = useState<any[]>([]);
  const [poolCode, setPoolCode] = useState("");
  const [currentPool, setCurrentPool] = useState<any>(null);

  // Forms
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showModal, setShowModal] = useState<"" | "createPool" | "submitCert" | "viewCerts">("");
  const [verifyHash, setVerifyHash] = useState("");
  const [verifyResult, setVerifyResult] = useState<any>(null);

  const { toasts, addToast, removeToast } = useToast();

  const provider = useMemo(() => {
    if (typeof window === "undefined" || !(window as any).ethereum) return null;
    return new ethers.BrowserProvider((window as any).ethereum);
  }, []);

  // Load public stats
  const loadStats = useCallback(async () => {
    try {
      const s = await api.publicStats();
      setStats(s);
    } catch { }
  }, []);

  // Load data based on role
  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const me = await api.getMe(token);
      setUserData(me.user);
      setValidatorRequest(me.validator_request);

      if (role === "admin") {
        const reqs = await api.listValidatorRequests(token);
        setPendingRequests(reqs);
        const vals = await api.listValidators(token);
        setValidators(vals);
      }

      if (role === "validator") {
        const pools = await api.myPools(token);
        setMyPools(pools);
        const info = await api.getPoolInfo();
        setPoolInfo(info);
      }

      if (role === "certificator") {
        const certs = await api.myCertificates(token);
        setMyCertificates(certs);
      }
    } catch { }
  }, [token, role]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadData(); }, [loadData]);

  // Restore session
  useEffect(() => {
    const t = localStorage.getItem("etched_token");
    const r = localStorage.getItem("etched_role") as Role;
    const w = localStorage.getItem("etched_wallet") || "";
    if (t && r) {
      setToken(t);
      setRole(r);
      setWallet(w);
      setSection("dashboard");
    }
  }, []);

  const [registerFile, setRegisterFile] = useState<File | null>(null);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);

  // === ACTIONS ===
  const handleLogin = async () => {
    if (!formData.email || !formData.password) return addToast("Fill all fields", "warning");
    setLoading(true);
    try {
      const res = await api.login(formData.email, formData.password);
      setToken(res.token);
      setRole(res.role);
      setUserData(res.user);
      localStorage.setItem("etched_token", res.token);
      localStorage.setItem("etched_role", res.role);
      setSection("dashboard");
      addToast(`Welcome, ${res.user.username}!`, "success");
      setFormData({});
    } catch (err: any) {
      addToast(err.message || "Login failed", "error");
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!formData.username || !formData.email || !formData.password || !formData.institution_name || !formData.institution_id) {
      return addToast("Please fill all required fields", "warning");
    }
    setLoading(true);
    try {
      let docUrl = formData.document_url || "";
      if (registerFile) {
        docUrl = await uploadToIPFS(registerFile);
      }

      await api.registerValidator({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        institution_name: formData.institution_name,
        institution_id: formData.institution_id,
        document_url: docUrl
      });
      addToast("Registration submitted! Login to check status.", "success");
      setSection("login");
      setFormData({});
      setRegisterFile(null);
    } catch (err: any) {
      addToast(err.message || "Registration failed", "error");
    }
    setLoading(false);
  };

  const handleCertificatorLogin = async () => {
    if (!provider) return addToast("Wallet required", "error");
    setLoading(true);
    try {
      const acc = await provider.send("eth_requestAccounts", []);
      const address = acc[0].toLowerCase();
      const { nonce } = await api.getNonce(address);
      // Construct message manually to ensure exact match with backend
      const message = `Login to Etched: ${nonce}`;
      const signer = await provider.getSigner();
      const sig = await signer.signMessage(message);
      const res = await api.verifyWallet(address, sig);
      setToken(res.token);
      setRole("certificator");
      setWallet(address);
      localStorage.setItem("etched_token", res.token);
      localStorage.setItem("etched_role", "certificator");
      localStorage.setItem("etched_wallet", address);
      setSection("certificator");
      addToast("Connected as certificator", "success");
    } catch (err: any) {
      addToast(err.message || "Connection failed", "error");
    }
    setLoading(false);
  };

  const handleConnectWallet = async () => {
    if (!provider) return addToast("Wallet required", "error");
    setLoading(true);
    try {
      const acc = await provider.send("eth_requestAccounts", []);
      await api.connectWallet(token, acc[0]);
      setWallet(acc[0].toLowerCase());
      localStorage.setItem("etched_wallet", acc[0].toLowerCase());
      addToast("Wallet connected!", "success");
      loadData();
    } catch (err: any) {
      addToast(err.message || "Failed to connect wallet", "error");
    }
    setLoading(false);
  };

  const signOut = () => {
    setToken(""); setRole(""); setWallet("");
    setUserData(null); setValidatorRequest(null);
    localStorage.removeItem("etched_token");
    localStorage.removeItem("etched_role");
    localStorage.removeItem("etched_wallet");
    setSection("home");
  };

  const handleCreatePool = async () => {
    if (!formData.pool_name) return addToast("Pool name required", "warning");
    if (!wallet) return addToast("Connect wallet first", "warning");
    if (!provider || !poolInfo) return;

    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const contract = getContract(signer);

      // Call createPool on contract
      const tx = await contract.createPool(formData.pool_name, formData.pool_description || "", {
        value: ethers.parseEther(poolInfo.pool_cost_eth.toString())
      });
      await tx.wait();

      // Create pool in backend
      const res = await api.createPool(token, {
        name: formData.pool_name,
        description: formData.pool_description,
        tx_hash: tx.hash
      });

      addToast(`Pool created! Code: ${res.pool.code}`, "success");
      setShowModal("");
      setFormData({});
      loadData();
    } catch (err: any) {
      addToast(err.message || "Failed to create pool", "error");
    }
    setLoading(false);
  };

  const handleLookupPool = async () => {
    if (!poolCode) return addToast("Enter pool code", "warning");
    setLoading(true);
    try {
      const pool = await api.getPool(poolCode.toUpperCase());
      setCurrentPool(pool);
      addToast("Pool found!", "success");
    } catch {
      addToast("Pool not found", "error");
      setCurrentPool(null);
    }
    setLoading(false);
  };

  const handleSubmitCertificate = async () => {
    if (!currentPool) return;
    if (!formData.recipient_name || !formData.recipient_wallet || !formData.certificate_type) {
      return addToast("Fill all fields", "warning");
    }
    setLoading(true);
    try {
      let metaUri = "";
      if (certificateFile) {
        metaUri = await uploadToIPFS(certificateFile);
      }

      // Generate document hash
      const dataToHash = JSON.stringify({
        recipient: formData.recipient_wallet,
        name: formData.recipient_name,
        type: formData.certificate_type,
        pool: currentPool.code,
        timestamp: Date.now(),
        file: metaUri
      });
      const docHash = ethers.keccak256(ethers.toUtf8Bytes(dataToHash));

      await api.submitCertificate(token, currentPool.code, {
        recipient_name: formData.recipient_name,
        recipient_wallet: formData.recipient_wallet,
        certificate_type: formData.certificate_type,
        document_hash: docHash,
        metadata_uri: metaUri
      });

      addToast("Certificate submitted!", "success");
      setShowModal("");
      setFormData({});
      loadData();
    } catch (err: any) {
      addToast(err.message || "Submission failed", "error");
    }
    setLoading(false);
  };

  const handleDecideValidator = async (id: number, approve: boolean) => {
    setLoading(true);
    try {
      await api.decideValidatorRequest(token, id, approve);
      addToast(approve ? "Validator approved" : "Validator rejected", "success");
      loadData();
    } catch (err: any) {
      addToast(err.message || "Failed", "error");
    }
    setLoading(false);
  };

  const handleVerify = async () => {
    if (!verifyHash) return addToast("Enter hash", "warning");
    setLoading(true);
    try {
      const res = await api.verifyCertificate(verifyHash);
      setVerifyResult(res);
      addToast(res.valid ? "Certificate verified!" : "Not found", res.valid ? "success" : "warning");
    } catch {
      setVerifyResult(null);
      addToast("Verification failed", "error");
    }
    setLoading(false);
  };

  // === RENDER ===
  return (
    <div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Background */}
      <div className="dot-canvas">
        <div className="dot-pattern" />
        <div className="floating-shape shape-cyan" />
        <div className="floating-shape shape-purple" />
      </div>

      {/* Navbar */}
      {/* Navbar: Floating Pill */}
      <nav className="navbar">
        <div className="nav-brand" onClick={() => setSection(token ? "dashboard" : "home")}>
          <Icons.Logo width={20} style={{ color: "black" }} />
          <span className="nav-brand-text">ETCHED.SYS</span>
        </div>

        {token ? (
          <button className="btn-connect" onClick={signOut} style={{ background: "black", color: "white" }}>
            {role === "certificator" ? `${wallet.slice(0, 6)}...` : userData?.username}
          </button>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            {section !== "home" && <button className="btn-connect" onClick={() => setSection("home")}>HOME</button>}
            <button className="btn-connect" onClick={() => setSection("login")}>LOGIN</button>
            {/* <button className="btn-connect" style={{ background: "black", color: "white" }} onClick={handleCertificatorLogin}>
              CONNECT
            </button> */}
          </div>
        )}
      </nav>

      {/* === HOME === */}
      {section === "home" && (
        <div className="hero">
          <div className="hero-title-wrapper">
            <h1 className="hero-text-black">THE</h1>
            <div className="truth-box">
              <h2 className="hero-text-purple">TRUTH</h2>
            </div>
            <h1 className="hero-text-black">IS ON-CHAIN</h1>
          </div>
          <p className="hero-subtitle">
            Secure • Transparent • Immortal<br />
            Verifiable Certificates on Ethereum Sepolia
          </p>
          <div className="hero-cta">
            <button className="btn-brutal" onClick={() => setSection("login")}>LOGIN →</button>
            <button className="btn-brutal" onClick={() => setSection("certificator")}>CERTIFICATOR</button>
            <button className="btn-brutal" onClick={() => setSection("verify")}>VERIFY</button>
          </div>
        </div>
      )}

      {/* === LOGIN === */}
      {section === "login" && (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 10 }}>
          <div className="paper-card" style={{ maxWidth: 420, width: "90%" }}>
            <div className="card-eyebrow">admin / validator</div>
            <h2 className="card-title">LOGIN</h2>
            <div style={{ display: "grid", gap: 14 }}>
              <input placeholder="Email" type="email" value={formData.email || ""} onChange={e => setFormData({ ...formData, email: e.target.value })} autoFocus />
              <input placeholder="Password" type="password" value={formData.password || ""} onChange={e => setFormData({ ...formData, password: e.target.value })} />
              <button className="btn-primary" onClick={handleLogin} disabled={loading}>{loading ? <Icons.Loader width={16} /> : "LOGIN →"}</button>
            </div>
            <div style={{ marginTop: 24, textAlign: "center", fontSize: "0.85rem" }}>
              New validator? <span style={{ color: "var(--c-purple)", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }} onClick={() => setSection("register")}>Register here</span>
            </div>
            <button className="btn-outline" onClick={() => setSection("home")}>← BACK</button>
          </div>
        </div>
      )}

      {/* === REGISTER === */}
      {section === "register" && (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 10 }}>
          <div className="paper-card" style={{ maxWidth: 520, width: "90%" }}>
            <div className="card-eyebrow">validator registration</div>
            <h2 className="card-title">Become a Validator</h2>
            <p style={{ fontSize: "0.9rem", marginBottom: 24 }}>Register your institution to validate certificates on the blockchain.</p>
            <div style={{ display: "grid", gap: 14 }}>
              <input placeholder="Username *" value={formData.username || ""} onChange={e => setFormData({ ...formData, username: e.target.value })} />
              <input placeholder="Email *" type="email" value={formData.email || ""} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              <input placeholder="Password *" type="password" value={formData.password || ""} onChange={e => setFormData({ ...formData, password: e.target.value })} />
              <input placeholder="Institution Name *" value={formData.institution_name || ""} onChange={e => setFormData({ ...formData, institution_name: e.target.value })} />
              <input placeholder="Institution ID *" value={formData.institution_id || ""} onChange={e => setFormData({ ...formData, institution_id: e.target.value })} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 700 }}>Proof Document (License/ID)</label>
                <input type="file" onChange={e => setRegisterFile(e.target.files?.[0] || null)} style={{ padding: "10px", background: "#fff" }} />
              </div>
              <button className="btn-primary" onClick={handleRegister} disabled={loading}>{loading ? <Icons.Loader width={16} /> : "SUBMIT REGISTRATION →"}</button>
            </div>
            <button className="btn-outline" onClick={() => setSection("home")}>← BACK</button>
          </div>
        </div>
      )}

      {/* === VERIFY === */}
      {section === "verify" && (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 10 }}>
          <div className="paper-card" style={{ maxWidth: 600, width: "90%" }}>
            <div className="card-eyebrow">public verification</div>
            <h2 className="card-title">verify certificate</h2>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <input placeholder="Enter certificate hash (0x...)" value={verifyHash} onChange={e => setVerifyHash(e.target.value)} style={{ flex: 1, padding: "12px 16px", borderRadius: 0, border: "2px solid var(--c-black)", background: "#f0f0f0", color: "var(--c-black)" }} />
              <button className="btn-primary" style={{ width: "auto", padding: "0 24px", marginTop: 0 }} onClick={handleVerify} disabled={loading}>{loading ? <Icons.Loader width={16} /> : "verify"}</button>
            </div>
            {verifyResult && (
              <div style={{ marginTop: 20, padding: 16, background: verifyResult.valid ? "rgba(100,200,100,0.1)" : "rgba(200,100,100,0.1)", border: "2px solid var(--c-black)" }}>
                {verifyResult.valid ? (
                  <>
                    <p style={{ fontWeight: 700, color: "var(--c-black)", marginBottom: 12 }}><Icons.Check width={16} style={{ marginRight: 6 }} />Certificate Valid</p>
                    <p style={{ fontSize: "0.85rem", marginBottom: 4 }}>Recipient: {verifyResult.certificate.recipient_name}</p>
                    <p style={{ fontSize: "0.85rem", marginBottom: 4 }}>Type: {verifyResult.certificate.certificate_type}</p>
                    <p style={{ fontSize: "0.85rem", marginBottom: 4 }}>Issuer: {verifyResult.issuer.institution_name}</p>
                    <p style={{ fontSize: "0.85rem" }}>Token ID: #{verifyResult.certificate.token_id}</p>
                  </>
                ) : (
                  <p style={{ fontWeight: 700, color: "var(--c-black)" }}><Icons.X width={16} style={{ marginRight: 6 }} />Certificate Not Found</p>
                )}
              </div>
            )}
            <button className="btn-outline" onClick={() => setSection(token ? "dashboard" : "home")}>← BACK</button>
          </div>
        </div>
      )}

      {/* === CERTIFICATOR LOGIN (If not logged in) === */}
      {section === "certificator" && role !== "certificator" && (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 10 }}>
          <div className="paper-card" style={{ maxWidth: 420, width: "90%", textAlign: "center" }}>
            <div className="card-eyebrow">certificator access</div>
            <h2 className="card-title">Connect Wallet</h2>
            <p style={{ marginBottom: 24, fontSize: "0.9rem" }}>Connect your wallet to submit certificates.</p>
            <button className="btn-primary" onClick={handleCertificatorLogin} disabled={loading}>{loading ? <Icons.Loader width={16} /> : "CONNECT WALLET →"}</button>
            <button className="btn-outline" onClick={() => setSection("home")}>← BACK</button>
          </div>
        </div>
      )}

      {/* === ADMIN DASHBOARD === */}
      {section === "dashboard" && role === "admin" && (
        <div className="dashboard">
          <div className="dash-grid">
            <div className="paper-card col-4 accent">
              <div className="card-eyebrow">admin</div>
              <div style={{ fontSize: "1.1rem", fontStyle: "italic" }}>{userData?.username}</div>
            </div>
            <div className="paper-card col-4">
              <div className="card-eyebrow">pending requests</div>
              <div className="card-value">{pendingRequests.length}</div>
            </div>
            <div className="paper-card col-4">
              <div className="card-eyebrow">approved validators</div>
              <div className="card-value">{validators.length}</div>
            </div>

            <div className="paper-card col-12">
              <div className="card-eyebrow">pending validator requests</div>
              {pendingRequests.length === 0 ? (
                <p style={{ color: "var(--c-text-mid)" }}>No pending requests</p>
              ) : (
                <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                  {pendingRequests.map((r: any, i: number) => (
                    <div key={i} style={{ padding: 16, background: "rgba(255,255,255,0.05)", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{r.user.username} - {r.request.institution_name}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--c-text-mid)" }}>{r.user.email}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn-primary" style={{ padding: "8px 16px" }} onClick={() => handleDecideValidator(r.request.id, true)} disabled={loading}><Icons.Check width={14} /></button>
                        <button className="btn-outline" style={{ padding: "8px 16px" }} onClick={() => handleDecideValidator(r.request.id, false)} disabled={loading}><Icons.X width={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === VALIDATOR DASHBOARD === */}
      {section === "dashboard" && role === "validator" && (
        <div className="dashboard">
          <div className="dash-grid">
            <div className="paper-card col-4 accent">
              <div className="card-eyebrow">validator</div>
              <div style={{ fontSize: "1rem", fontStyle: "italic" }}>{userData?.username}</div>
              <div style={{ fontSize: "0.75rem", opacity: 0.8, marginTop: 4 }}>{validatorRequest?.institution_name}</div>
            </div>
            <div className="paper-card col-4">
              <div className="card-eyebrow">status</div>
              <div className="card-value" style={{ fontSize: "1.5rem", color: validatorRequest?.status === "approved" ? "#8FC88F" : "#F0C868" }}>
                {validatorRequest?.status || "pending"}
              </div>
            </div>
            <div className="paper-card col-4">
              <div className="card-eyebrow">wallet</div>
              {wallet ? (
                <div style={{ fontSize: "0.85rem" }}>{wallet.slice(0, 10)}...</div>
              ) : (
                <button className="btn-primary" style={{ marginTop: 8 }} onClick={handleConnectWallet} disabled={loading}>
                  <Icons.Wallet width={14} style={{ marginRight: 6 }} /> connect
                </button>
              )}
            </div>

            {validatorRequest?.status === "approved" && (
              <>
                <div className="paper-card col-6">
                  <div className="card-eyebrow">create pool</div>
                  <p style={{ color: "var(--c-text-mid)", fontSize: "0.85rem", marginBottom: 12 }}>
                    Create a certificate pool. Cost: {poolInfo?.pool_cost_eth || 0.1} ETH
                  </p>
                  <button className="btn-primary" onClick={() => setShowModal("createPool")} disabled={!wallet || loading}>
                    <Icons.Plus width={14} style={{ marginRight: 6 }} /> create pool
                  </button>
                </div>
                <div className="paper-card col-6">
                  <div className="card-eyebrow">my pools</div>
                  <div className="card-value">{myPools.length}</div>
                </div>

                <div className="paper-card col-12">
                  <div className="card-eyebrow">pools</div>
                  {myPools.length === 0 ? (
                    <p style={{ color: "var(--c-text-mid)" }}>No pools yet</p>
                  ) : (
                    <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                      {myPools.map((p: any, i: number) => (
                        <div key={i} style={{ padding: 16, background: "rgba(255,255,255,0.05)", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{p.pool.name}</div>
                            <div style={{ fontSize: "0.9rem", color: "var(--c-orange)", fontFamily: "monospace" }}>{p.pool.code}</div>
                          </div>
                          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: "0.75rem", color: "var(--c-text-mid)" }}>pending</div>
                              <div style={{ fontWeight: 600 }}>{p.pending_certificates}</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: "0.75rem", color: "var(--c-text-mid)" }}>minted</div>
                              <div style={{ fontWeight: 600 }}>{p.minted_certificates}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {validatorRequest?.status === "pending" && (
              <div className="paper-card col-12">
                <div style={{ textAlign: "center", padding: 40 }}>
                  <Icons.Clock width={48} style={{ color: "var(--c-orange)", marginBottom: 16 }} />
                  <h3 style={{ fontStyle: "italic", marginBottom: 8 }}>Awaiting Approval</h3>
                  <p style={{ color: "var(--c-text-mid)" }}>Your validator request is being reviewed by admin.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === CERTIFICATOR === */}
      {(section === "dashboard" || section === "certificator") && role === "certificator" && (
        <div className="dashboard">
          <div className="dash-grid">
            <div className="paper-card col-4 accent">
              <div className="card-eyebrow">certificator</div>
              <div style={{ fontSize: "0.9rem" }}>{wallet.slice(0, 14)}...</div>
            </div>
            <div className="paper-card col-4">
              <div className="card-eyebrow">my certificates</div>
              <div className="card-value">{myCertificates.length}</div>
            </div>
            <div className="paper-card col-4">
              <div className="card-eyebrow">enter pool code</div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input
                  placeholder="ABC123"
                  value={poolCode}
                  onChange={e => setPoolCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  style={{ flex: 1, marginBottom: 0, textTransform: "uppercase" }}
                />
                <button
                  className="btn-primary"
                  style={{ width: "auto", padding: "0 16px", marginTop: 0 }}
                  onClick={handleLookupPool}
                  disabled={loading}
                >
                  <Icons.Search width={16} />
                </button>
              </div>
            </div>

            {currentPool && (
              <div className="paper-card col-12">
                <div className="card-eyebrow">pool: {currentPool.code}</div>
                <h3 className="card-title">{currentPool.name}</h3>
                <p style={{ color: "var(--c-text-mid)", fontSize: "0.85rem", marginBottom: 16 }}>Institution: {currentPool.institution_name}</p>
                <button className="btn-primary" onClick={() => setShowModal("submitCert")}>
                  <Icons.File width={14} style={{ marginRight: 6 }} /> submit certificate
                </button>
              </div>
            )}

            <div className="paper-card col-12">
              <div className="card-eyebrow">my submissions</div>
              {myCertificates.length === 0 ? (
                <p style={{ color: "var(--c-text-mid)" }}>No certificates submitted yet</p>
              ) : (
                <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                  {myCertificates.map((c: any, i: number) => (
                    <div key={i} style={{ padding: 16, background: "rgba(255,255,255,0.05)", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{c.certificate.certificate_type}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--c-text-mid)" }}>Pool: {c.pool_code}</div>
                      </div>
                      <span style={{
                        padding: "4px 12px", borderRadius: 20, fontSize: "0.7rem", fontWeight: 600,
                        background: c.certificate.status === "minted" ? "rgba(100,180,100,0.2)" : c.certificate.status === "rejected" ? "rgba(180,100,100,0.2)" : "rgba(200,180,100,0.2)",
                        color: c.certificate.status === "minted" ? "#8FC88F" : c.certificate.status === "rejected" ? "#C88F8F" : "#C8B88F"
                      }}>
                        {c.certificate.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === MODALS === */}
      {showModal === "createPool" && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 className="card-title" style={{ marginBottom: 0 }}>Create Pool</h3>
              <button onClick={() => setShowModal("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-black)" }}><Icons.X width={24} /></button>
            </div>
            <p style={{ fontSize: "0.85rem", marginBottom: 16 }}>Cost: {poolInfo?.pool_cost_eth || 0.1} ETH (sent to admin).</p>
            <div style={{ display: "grid", gap: 12 }}>
              <input placeholder="Pool Name *" value={formData.pool_name || ""} onChange={e => setFormData({ ...formData, pool_name: e.target.value })} />
              <textarea placeholder="Description (optional)" value={formData.pool_description || ""} onChange={e => setFormData({ ...formData, pool_description: e.target.value })} rows={3} style={{ width: "100%", padding: "14px", border: "2px solid var(--c-black)", fontFamily: "var(--font-mono)", fontSize: "1rem", resize: "none", background: "#f0f0f0" }} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button className="btn-outline" style={{ flex: 1, marginTop: 0 }} onClick={() => setShowModal("")}>cancel</button>
              <button className="btn-primary" style={{ flex: 1, marginTop: 0 }} onClick={handleCreatePool} disabled={loading}>{loading ? <Icons.Loader width={16} /> : `pay & create`}</button>
            </div>
          </div>
        </div>
      )}

      {showModal === "submitCert" && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 className="card-title" style={{ marginBottom: 0 }}>Submit Certificate</h3>
              <button onClick={() => setShowModal("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-black)" }}><Icons.X width={24} /></button>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <input placeholder="Recipient Name *" value={formData.recipient_name || ""} onChange={e => setFormData({ ...formData, recipient_name: e.target.value })} />
              <input placeholder="Recipient Wallet (0x...) *" value={formData.recipient_wallet || ""} onChange={e => setFormData({ ...formData, recipient_wallet: e.target.value })} />
              <select value={formData.certificate_type || ""} onChange={e => setFormData({ ...formData, certificate_type: e.target.value })}>
                <option value="">Select Type *</option>
                <option value="Diploma">Diploma</option>
                <option value="Certificate">Certificate</option>
                <option value="Degree">Degree</option>
                <option value="License">License</option>
              </select>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 700 }}>Certificate File (Image/PDF)</label>
                <input type="file" onChange={e => setCertificateFile(e.target.files?.[0] || null)} style={{ padding: "10px", background: "#fff" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button className="btn-outline" style={{ flex: 1, marginTop: 0 }} onClick={() => setShowModal("")}>cancel</button>
              <button className="btn-primary" style={{ flex: 1, marginTop: 0 }} onClick={handleSubmitCertificate} disabled={loading}>{loading ? <Icons.Loader width={16} /> : "submit"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
