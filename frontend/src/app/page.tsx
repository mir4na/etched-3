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
  Eye: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>),
  Clock: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>),
  Wallet: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" /></svg>),
  Back: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>),
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
  const [selectedPool, setSelectedPool] = useState<any>(null);
  const [poolCertificates, setPoolCertificates] = useState<any[]>([]);

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

  const switchNetwork = async () => {
    if (!provider) return;
    try {
      await provider.send("wallet_switchEthereumChain", [{ chainId: "0xaa36a7" }]);
    } catch (err: any) {
      if (err.code === 4902 || err?.info?.error?.code === 4902) {
        try {
          await provider.send("wallet_addEthereumChain", [{
            chainId: "0xaa36a7",
            chainName: "Sepolia Testnet",
            nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://rpc.sepolia.org"],
            blockExplorerUrls: ["https://sepolia.etherscan.io"]
          }]);
        } catch (e) { console.error(e); }
      }
    }
  };

  const handleConnectWallet = async () => {
    if (!provider) return addToast("Wallet required", "error");
    setLoading(true);
    try {
      await switchNetwork();
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
    if (!provider) return addToast("Wallet provider not found", "error");

    setLoading(true);
    try {
      await switchNetwork();
      const signer = await provider.getSigner();
      const contract = getContract(signer);
      const cost = poolInfo?.pool_cost_eth || "0.1";

      // Call createPool on contract
      const tx = await contract.createPool(formData.pool_name, formData.pool_description || "", {
        value: ethers.parseEther(cost.toString())
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

  // Load certificates for a pool
  const loadPoolCertificates = async (pool: any) => {
    setSelectedPool(pool);
    setLoading(true);
    try {
      const certs = await api.listPoolCertificates(token, pool.pool.code);
      setPoolCertificates(certs);
    } catch (err: any) {
      addToast(err.message || "Failed to load certificates", "error");
    }
    setLoading(false);
  };

  // Approve certificate and mint
  const handleApproveCertificate = async (cert: any) => {
    if (!provider) return addToast("Wallet required", "error");
    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const contract = getContract(signer);

      // Call smart contract to mint - using submitCertificateRequest then approve
      const tx = await contract.submitCertificateRequest(
        cert.recipient_wallet,
        cert.document_hash,
        cert.metadata_uri || "",
        validatorRequest?.institution_id || "",
        cert.certificate_type
      );
      const receipt = await tx.wait();

      // Get token ID from event
      const event = receipt.logs.find((log: any) => log.fragment?.name === "CertificateRequested");
      const tokenId = event ? Number(event.args[0]) : 1;

      // Update backend
      await api.decideCertificate(token, cert.id, {
        approve: true,
        tx_hash: tx.hash,
        token_id: tokenId
      });

      addToast("Certificate approved and minted!", "success");
      loadPoolCertificates(selectedPool);
      loadData();
    } catch (err: any) {
      addToast(err.message || "Failed to approve", "error");
    }
    setLoading(false);
  };

  // Reject certificate
  const handleRejectCertificate = async (cert: any, reason: string) => {
    setLoading(true);
    try {
      await api.decideCertificate(token, cert.id, {
        approve: false,
        rejection_reason: reason || "Rejected by validator"
      });
      addToast("Certificate rejected", "success");
      loadPoolCertificates(selectedPool);
      loadData();
    } catch (err: any) {
      addToast(err.message || "Failed to reject", "error");
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
                <div className="request-grid">
                  {pendingRequests.map((r: any, i: number) => (
                    <div key={i} className="request-card">
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #eee", paddingBottom: 8, marginBottom: 4 }}>
                        <div style={{ fontWeight: 800 }}>{r.user.username}</div>
                        <div style={{ fontSize: "0.7rem", color: "#888" }}>ID: {r.request.id}</div>
                      </div>
                      <div style={{ fontSize: "0.9rem" }}>{r.request.institution_name}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--c-text-mid)", fontFamily: "monospace" }}>{r.user.email}</div>

                      <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                        <button className="btn-primary" style={{ padding: "8px", flex: 1, fontSize: "0.8rem" }} onClick={() => handleDecideValidator(r.request.id, true)} disabled={loading}>APPROVE</button>
                        <button className="btn-outline" style={{ padding: "8px", flex: 1, fontSize: "0.8rem", marginTop: 0 }} onClick={() => handleDecideValidator(r.request.id, false)} disabled={loading}>REJECT</button>
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
        <div className="validator-dashboard">
          {/* Header */}
          <div className="vd-header">
            <div className="vd-header-info">
              <div className="vd-avatar">{userData?.username?.charAt(0).toUpperCase()}</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>{userData?.username}</div>
                <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>{validatorRequest?.institution_name}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {wallet ? (
                <div className="vd-wallet-badge">
                  <Icons.Wallet width={14} /> {wallet.slice(0, 8)}...{wallet.slice(-4)}
                </div>
              ) : (
                <button className="btn-primary" style={{ padding: "8px 16px", marginTop: 0 }} onClick={handleConnectWallet} disabled={loading}>
                  <Icons.Wallet width={14} /> Connect
                </button>
              )}
              <div className="status-badge" style={{ background: validatorRequest?.status === "approved" ? "#8FC88F" : "#F0C868" }}>
                {validatorRequest?.status || "pending"}
              </div>
            </div>
          </div>

          {validatorRequest?.status === "pending" && (
            <div className="vd-pending">
              <Icons.Clock width={64} style={{ color: "#F0C868", marginBottom: 20 }} />
              <h2 style={{ marginBottom: 8 }}>Awaiting Admin Approval</h2>
              <p style={{ opacity: 0.7 }}>Your validator request is being reviewed. Please wait for admin approval.</p>
            </div>
          )}

          {validatorRequest?.status === "approved" && !selectedPool && (
            <div className="vd-content">
              {/* Stats Row */}
              <div className="vd-stats">
                <div className="vd-stat-card">
                  <div className="vd-stat-value">{myPools.length}</div>
                  <div className="vd-stat-label">Pools</div>
                </div>
                <div className="vd-stat-card">
                  <div className="vd-stat-value">{myPools.reduce((acc, p) => acc + p.pending_certificates, 0)}</div>
                  <div className="vd-stat-label">Pending Certs</div>
                </div>
                <div className="vd-stat-card">
                  <div className="vd-stat-value">{myPools.reduce((acc, p) => acc + p.minted_certificates, 0)}</div>
                  <div className="vd-stat-label">Minted</div>
                </div>
                <button className="vd-create-btn" onClick={() => setShowModal("createPool")} disabled={!wallet || loading}>
                  <Icons.Plus width={20} />
                  <span>Create Pool</span>
                  <small>{poolInfo?.pool_cost_eth || 0.1} ETH</small>
                </button>
              </div>

              {/* Pools Grid */}
              <div className="vd-section-header">
                <h3>Your Pools</h3>
                <button onClick={loadData} style={{ background: "none", border: "none", cursor: "pointer" }}>
                  <Icons.Loader width={16} />
                </button>
              </div>

              {myPools.length === 0 ? (
                <div className="vd-empty">
                  <p>No pools yet. Create your first pool to start accepting certificates.</p>
                </div>
              ) : (
                <div className="vd-pools-grid">
                  {myPools.map((p: any, i: number) => (
                    <div key={i} className="vd-pool-card" onClick={() => loadPoolCertificates(p)}>
                      <div className="vd-pool-header">
                        <span className="vd-pool-code">{p.pool.code}</span>
                        <span className={`vd-pool-status ${p.pool.is_active ? "active" : ""}`}>
                          {p.pool.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="vd-pool-name">{p.pool.name}</div>
                      <div className="vd-pool-stats">
                        <div><strong>{p.pending_certificates}</strong> pending</div>
                        <div><strong>{p.minted_certificates}</strong> minted</div>
                      </div>
                      <div className="vd-pool-action">
                        <Icons.Eye width={14} /> View Certificates
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pool Detail View */}
          {validatorRequest?.status === "approved" && selectedPool && (
            <div className="vd-content">
              <button className="vd-back-btn" onClick={() => { setSelectedPool(null); setPoolCertificates([]); }}>
                <Icons.Back width={16} /> Back to Pools
              </button>

              <div className="vd-pool-detail-header">
                <div>
                  <span className="vd-pool-code" style={{ fontSize: "1.5rem" }}>{selectedPool.pool.code}</span>
                  <h2 style={{ margin: "8px 0" }}>{selectedPool.pool.name}</h2>
                </div>
                <div className="vd-pool-stats" style={{ flexDirection: "row", gap: 24 }}>
                  <div><strong>{selectedPool.pending_certificates}</strong> pending</div>
                  <div><strong>{selectedPool.minted_certificates}</strong> minted</div>
                </div>
              </div>

              <div className="vd-section-header">
                <h3>Certificates</h3>
                <button onClick={() => loadPoolCertificates(selectedPool)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                  <Icons.Loader width={16} />
                </button>
              </div>

              {poolCertificates.length === 0 ? (
                <div className="vd-empty">
                  <p>No certificates submitted to this pool yet.</p>
                </div>
              ) : (
                <div className="vd-certs-list">
                  {poolCertificates.map((cert: any, i: number) => (
                    <div key={i} className={`vd-cert-card ${cert.status}`}>
                      <div className="vd-cert-header">
                        <div>
                          <div className="vd-cert-type">{cert.certificate_type}</div>
                          <div className="vd-cert-recipient">{cert.recipient_name}</div>
                        </div>
                        <span className={`vd-cert-status ${cert.status}`}>{cert.status}</span>
                      </div>
                      <div className="vd-cert-details">
                        <div><strong>Wallet:</strong> {cert.recipient_wallet.slice(0, 10)}...{cert.recipient_wallet.slice(-6)}</div>
                        <div><strong>Hash:</strong> {cert.document_hash.slice(0, 16)}...</div>
                      </div>
                      {cert.status === "pending" && (
                        <div className="vd-cert-actions">
                          <button className="btn-approve" onClick={() => handleApproveCertificate(cert)} disabled={loading}>
                            <Icons.Check width={14} /> Approve & Mint
                          </button>
                          <button className="btn-reject" onClick={() => handleRejectCertificate(cert, "")} disabled={loading}>
                            <Icons.X width={14} /> Reject
                          </button>
                        </div>
                      )}
                      {cert.status === "minted" && cert.tx_hash && (
                        <a href={`https://sepolia.etherscan.io/tx/${cert.tx_hash}`} target="_blank" rel="noopener noreferrer" className="vd-cert-link">
                          View on Etherscan →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* === VALIDATOR REJECTED === */}
      {section === "dashboard" && role === "validator" && validatorRequest?.status === "rejected" && (
        <div className="dashboard">
          <div className="paper-card">
            <div style={{ textAlign: "center", padding: 40 }}>
              <Icons.X width={48} style={{ color: "#C88F8F", marginBottom: 16 }} />
              <h3 style={{ fontStyle: "italic", marginBottom: 8 }}>Request Rejected</h3>
              <p style={{ color: "var(--c-text-mid)" }}>Your validator request has been rejected by admin.</p>
            </div>
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
                <div className="request-grid">
                  {myCertificates.map((c: any, i: number) => (
                    <div key={i} className="request-card">
                      <div className="card-eyebrow" style={{ marginBottom: 8 }}>{c.certificate.certificate_type}</div>
                      <p style={{ fontSize: "0.9rem", marginBottom: 4 }}>Pool: <strong style={{ fontFamily: "monospace", fontSize: "1rem" }}>{c.pool_code}</strong></p>

                      <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span className="status-badge" style={{
                          background: c.certificate.status === "minted" ? "#8FC88F" : c.certificate.status === "rejected" ? "#C88F8F" : "#F0C868",
                          color: "black",
                          border: "2px solid black",
                          fontSize: "0.75rem",
                          padding: "2px 8px"
                        }}>
                          {c.certificate.status}
                        </span>
                        {c.certificate.tx_hash && (
                          <a href={`https://sepolia.etherscan.io/tx/${c.certificate.tx_hash}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.7rem", textDecoration: "underline", color: "black" }}>
                            View TX
                          </a>
                        )}
                      </div>
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
              <button className="btn-primary" style={{ flex: 1, marginTop: 0 }} onClick={handleCreatePool} disabled={loading}>
                {loading ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Icons.Loader width={16} /> PROCESSING...
                  </span>
                ) : "PAY & CREATE"}
              </button>
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
              <button className="btn-primary" style={{ flex: 1, marginTop: 0 }} onClick={handleSubmitCertificate} disabled={loading}>
                {loading ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Icons.Loader width={16} /> PROCESSING...
                  </span>
                ) : "SUBMIT"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
