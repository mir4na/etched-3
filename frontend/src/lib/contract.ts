import { ethers } from "ethers";

export const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "";
export const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "0");

export const contractAbi = [
  "event CertificateRequested(uint256 indexed requestId, address indexed certificator, address indexed recipient, string certificateHash, string institutionId)",
  "event CertificateMinted(uint256 indexed tokenId, uint256 indexed requestId, address indexed recipient, string certificateHash)",
  "function submitCertificateRequest(address recipient, string certificateHash, string metadataURI, string institutionId, string certificateType) returns (uint256)",
  "function approveCertificate(uint256 requestId)",
  "function rejectCertificate(uint256 requestId, string reason)",
  "function addValidator(address validator, string institutionId, string institutionName)",
  "function getCertificateRequest(uint256 requestId) view returns (tuple(uint256 requestId, address certificator, address recipient, string certificateHash, string metadataURI, string institutionId, string certificateType, uint8 status, uint256 createdAt, uint256 validatedAt, address validatedBy, string rejectionReason))",
  "function totalRequests() view returns (uint256)",
  "function verifyCertificateByHash(string certificateHash) view returns (bool isValid, uint256 tokenId, address recipient, string institutionId, uint256 mintedAt)"
];

export function getContract(signerOrProvider: ethers.Signer | ethers.Provider) {
  if (!contractAddress) {
    throw new Error("Missing NEXT_PUBLIC_CONTRACT_ADDRESS");
  }
  return new ethers.Contract(contractAddress, contractAbi, signerOrProvider);
}
