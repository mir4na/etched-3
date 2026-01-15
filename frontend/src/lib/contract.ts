import { ethers } from "ethers";

export const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "";
export const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "0");

export const contractAbi = [
  // Events
  "event CertificateRequested(uint256 indexed requestId, address indexed certificator, address indexed recipient, string certificateHash, string institutionId)",
  "event CertificateMinted(uint256 indexed tokenId, uint256 indexed requestId, address indexed recipient, string certificateHash)",
  "event CertificateApproved(uint256 indexed requestId, address indexed validator, uint256 timestamp)",
  "event CertificateRejected(uint256 indexed requestId, address indexed validator, string reason)",
  "event ValidatorAdded(address indexed validator, string institutionId, string institutionName)",
  "event ValidatorRemoved(address indexed validator)",

  // Certificator functions
  "function submitCertificateRequest(address recipient, string certificateHash, string metadataURI, string institutionId, string certificateType) returns (uint256)",

  // Validator functions
  "function approveCertificate(uint256 requestId)",
  "function rejectCertificate(uint256 requestId, string reason)",

  // Admin functions
  "function addValidator(address validator, string institutionId, string institutionName)",
  "function removeValidator(address validator)",

  // View functions
  "function getCertificateRequest(uint256 requestId) view returns (tuple(uint256 requestId, address certificator, address recipient, string certificateHash, string metadataURI, string institutionId, string certificateType, uint8 status, uint256 createdAt, uint256 validatedAt, address validatedBy, string rejectionReason))",
  "function getCertificate(uint256 tokenId) view returns (tuple(uint256 tokenId, uint256 requestId, address recipient, string certificateHash, string institutionId, string certificateType, uint256 mintedAt, address validatedBy))",
  "function verifyCertificateByHash(string certificateHash) view returns (bool isValid, uint256 tokenId, address recipient, string institutionId, uint256 mintedAt)",
  "function getRecipientCertificates(address recipient) view returns (uint256[])",
  "function totalRequests() view returns (uint256)",
  "function totalCertificates() view returns (uint256)",
  "function getValidator(address validator) view returns (tuple(address validatorAddress, string institutionId, string institutionName, bool isActive, uint256 addedAt))",
  "function isActiveValidator(address validator) view returns (bool)",

  // Role checks
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function ADMIN_ROLE() view returns (bytes32)",
  "function VALIDATOR_ROLE() view returns (bytes32)",

  // Pool Functions
  "event PoolCreated(uint256 indexed poolId, address indexed validator, string name, uint256 feePaid)",
  "function createPool(string name, string description) payable returns (uint256)",
  "function getPool(uint256 poolId) view returns (tuple(uint256 poolId, string name, string description, address validator, string institutionId, bool isActive, uint256 createdAt))",
  "function totalPools() view returns (uint256)",
  "function poolCreationFee() view returns (uint256)"
];

export function getContract(signerOrProvider: ethers.Signer | ethers.Provider) {
  if (!contractAddress) {
    throw new Error("Missing NEXT_PUBLIC_CONTRACT_ADDRESS");
  }
  return new ethers.Contract(contractAddress, contractAbi, signerOrProvider);
}
