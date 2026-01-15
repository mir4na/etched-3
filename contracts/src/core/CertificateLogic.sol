// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./ValidatorRegistry.sol";

/**
 * @title CertificateLogic
 * @dev Core certificate request and minting logic
 * @notice Handles the certificator -> validator -> minting workflow
 */
abstract contract CertificateLogic is ERC721URIStorage, ValidatorRegistry {
    // Resolve conflict between ERC721URIStorage and AccessControl (via ValidatorRegistry)
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        virtual
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    using Counters for Counters.Counter;

    // Counters
    Counters.Counter internal _tokenIdCounter;
    Counters.Counter internal _requestIdCounter;
    Counters.Counter internal _poolIdCounter;

    // Storage
    mapping(uint256 => CertificateRequest) internal _certificateRequests;
    mapping(uint256 => Certificate) internal _certificates;
    mapping(string => uint256) internal _hashToTokenId;
    mapping(string => bool) internal _usedHashes;
    mapping(address => uint256[]) internal _recipientCertificates;
    mapping(uint256 => Pool) internal _pools;

    // Config
    address public feeReceiver;
    uint256 public poolCreationFee = 0.1 ether;

    // ============ Certificator Functions ============

    /**
     * @dev Submit a certificate request
     * @param recipient Address of certificate recipient
     * @param certificateHash Hash of certificate data
     * @param metadataURI URI to certificate metadata
     * @param institutionId Institution issuing the certificate
     * @param certificateType Type of certificate
     */
    function submitCertificateRequest(
        address recipient,
        string memory certificateHash,
        string memory metadataURI,
        string memory institutionId,
        string memory certificateType
    ) external returns (uint256) {
        require(recipient != address(0), "Invalid recipient");
        require(bytes(certificateHash).length > 0, "Certificate hash required");
        require(!_usedHashes[certificateHash], "Certificate hash already used");
        require(bytes(institutionId).length > 0, "Institution ID required");

        _requestIdCounter.increment();
        uint256 requestId = _requestIdCounter.current();

        _certificateRequests[requestId] = CertificateRequest({
            requestId: requestId,
            certificator: msg.sender,
            recipient: recipient,
            certificateHash: certificateHash,
            metadataURI: metadataURI,
            institutionId: institutionId,
            certificateType: certificateType,
            status: CertificateStatus.Pending,
            createdAt: block.timestamp,
            validatedAt: 0,
            validatedBy: address(0),
            rejectionReason: ""
        });

        emit CertificateRequested(
            requestId,
            msg.sender,
            recipient,
            certificateHash,
            institutionId
        );

        return requestId;
    }

    // ============ Admin Config Functions ============

    function setFeeReceiver(address _receiver) external onlyRole(ADMIN_ROLE) {
        feeReceiver = _receiver;
    }

    function setPoolCreationFee(uint256 _fee) external onlyRole(ADMIN_ROLE) {
        poolCreationFee = _fee;
    }

    function withdraw(address payable _to) external onlyRole(ADMIN_ROLE) {
        (bool success, ) = _to.call{value: address(this).balance}("");
        require(success, "Withdraw failed");
    }

    // ============ Validator Functions ============

    /**
     * @dev Create a new certificate pool
     * @notice Anyone can create a pool by paying the fee
     * @notice Validator verification is done off-chain
     */
    function createPool(
        string memory name,
        string memory description
    ) external payable returns (uint256) {
        require(msg.value >= poolCreationFee, "Insufficient fee");
        require(bytes(name).length > 0, "Pool name required");

        if (poolCreationFee > 0 && feeReceiver != address(0)) {
            (bool success, ) = payable(feeReceiver).call{value: msg.value}("");
            require(success, "Transfer failed");
        }

        _poolIdCounter.increment();
        uint256 poolId = _poolIdCounter.current();

        _pools[poolId] = Pool({
            poolId: poolId,
            name: name,
            description: description,
            validator: msg.sender,
            institutionId: "",
            isActive: true,
            createdAt: block.timestamp
        });

        emit PoolCreated(poolId, msg.sender, name, msg.value);

        return poolId;
    }

    // ============ Validator Functions ============

    /**
     * @dev Approve a certificate request and mint SBT
     * @param requestId ID of the certificate request
     */
    function approveCertificate(
        uint256 requestId
    ) external onlyRole(VALIDATOR_ROLE) {
        CertificateRequest storage request = _certificateRequests[requestId];

        require(request.requestId != 0, "Request not found");
        require(
            request.status == CertificateStatus.Pending,
            "Request not pending"
        );
        require(_validators[msg.sender].isActive, "Validator not active");
        require(
            _isValidatorForInstitution(msg.sender, request.institutionId),
            "Validator not from this institution"
        );

        request.status = CertificateStatus.Approved;
        request.validatedAt = block.timestamp;
        request.validatedBy = msg.sender;

        emit CertificateApproved(requestId, msg.sender, block.timestamp);

        // Mint SBT
        _mintCertificate(requestId);
    }

    /**
     * @dev Reject a certificate request
     * @param requestId ID of the certificate request
     * @param reason Reason for rejection
     */
    function rejectCertificate(
        uint256 requestId,
        string memory reason
    ) external onlyRole(VALIDATOR_ROLE) {
        CertificateRequest storage request = _certificateRequests[requestId];

        require(request.requestId != 0, "Request not found");
        require(
            request.status == CertificateStatus.Pending,
            "Request not pending"
        );
        require(_validators[msg.sender].isActive, "Validator not active");
        require(
            _isValidatorForInstitution(msg.sender, request.institutionId),
            "Validator not from this institution"
        );

        request.status = CertificateStatus.Rejected;
        request.validatedAt = block.timestamp;
        request.validatedBy = msg.sender;
        request.rejectionReason = reason;

        emit CertificateRejected(requestId, msg.sender, reason);
    }

    // ============ Internal Functions ============

    /**
     * @dev Mint certificate SBT
     */
    function _mintCertificate(uint256 requestId) internal {
        CertificateRequest storage request = _certificateRequests[requestId];

        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();

        _safeMint(request.recipient, tokenId);
        _setTokenURI(tokenId, request.metadataURI);

        _certificates[tokenId] = Certificate({
            tokenId: tokenId,
            requestId: requestId,
            recipient: request.recipient,
            certificateHash: request.certificateHash,
            institutionId: request.institutionId,
            certificateType: request.certificateType,
            mintedAt: block.timestamp,
            validatedBy: request.validatedBy
        });

        _hashToTokenId[request.certificateHash] = tokenId;
        _usedHashes[request.certificateHash] = true;
        _recipientCertificates[request.recipient].push(tokenId);

        request.status = CertificateStatus.Minted;

        emit CertificateMinted(
            tokenId,
            requestId,
            request.recipient,
            request.certificateHash
        );
    }

    // ============ View Functions ============

    /**
     * @dev Verify certificate by hash
     */
    function verifyCertificateByHash(
        string memory certificateHash
    )
        external
        view
        returns (
            bool isValid,
            uint256 tokenId,
            address recipient,
            string memory institutionId,
            uint256 mintedAt
        )
    {
        tokenId = _hashToTokenId[certificateHash];
        if (tokenId == 0) {
            return (false, 0, address(0), "", 0);
        }

        Certificate memory cert = _certificates[tokenId];
        return (
            true,
            tokenId,
            cert.recipient,
            cert.institutionId,
            cert.mintedAt
        );
    }

    /**
     * @dev Get certificate by token ID
     */
    function getCertificate(
        uint256 tokenId
    ) external view returns (Certificate memory) {
        require(_exists(tokenId), "Certificate not found");
        return _certificates[tokenId];
    }

    /**
     * @dev Get certificate request
     */
    function getCertificateRequest(
        uint256 requestId
    ) external view returns (CertificateRequest memory) {
        require(
            _certificateRequests[requestId].requestId != 0,
            "Request not found"
        );
        return _certificateRequests[requestId];
    }

    /**
     * @dev Get all certificates for a recipient
     */
    function getRecipientCertificates(
        address recipient
    ) external view returns (uint256[] memory) {
        return _recipientCertificates[recipient];
    }

    /**
     * @dev Get total minted certificates
     */
    function totalCertificates() external view returns (uint256) {
        return _tokenIdCounter.current();
    }

    /**
     * @dev Get total certificate requests
     */
    function totalRequests() external view returns (uint256) {
        return _requestIdCounter.current();
    }

    /**
     * @dev Get pool info
     */
    function getPool(uint256 poolId) external view returns (Pool memory) {
        require(_pools[poolId].poolId != 0, "Pool not found");
        return _pools[poolId];
    }

    /**
     * @dev Get total pools
     */
    function totalPools() external view returns (uint256) {
        return _poolIdCounter.current();
    }
}
