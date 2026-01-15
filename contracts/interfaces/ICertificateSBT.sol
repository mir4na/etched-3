// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ICertificateSBT
 * @dev Interface for the Certificate SBT contract
 */
interface ICertificateSBT {
    // Enums
    enum CertificateStatus {
        Pending,
        Approved,
        Rejected,
        Minted
    }

    // Structs
    struct Institution {
        string name;
        string institutionId;
        bool isActive;
        uint256 registeredAt;
    }

    struct CertificateRequest {
        uint256 requestId;
        address certificator;
        address recipient;
        string certificateHash;
        string metadataURI;
        string institutionId;
        string certificateType;
        CertificateStatus status;
        uint256 createdAt;
        uint256 validatedAt;
        address validatedBy;
        string rejectionReason;
    }

    struct Certificate {
        uint256 tokenId;
        uint256 requestId;
        address recipient;
        string certificateHash;
        string institutionId;
        string certificateType;
        uint256 mintedAt;
        address validatedBy;
    }

    // Events
    event ValidatorAdded(
        address indexed validator,
        string institutionId,
        string institutionName
    );
    event ValidatorRemoved(address indexed validator);
    event ValidatorUpdated(
        address indexed validator,
        string institutionId,
        string institutionName
    );

    event CertificateRequested(
        uint256 indexed requestId,
        address indexed certificator,
        address indexed recipient,
        string certificateHash,
        string institutionId
    );

    event CertificateApproved(
        uint256 indexed requestId,
        address indexed validator,
        uint256 timestamp
    );

    event CertificateRejected(
        uint256 indexed requestId,
        address indexed validator,
        string reason
    );

    event CertificateMinted(
        uint256 indexed tokenId,
        uint256 indexed requestId,
        address indexed recipient,
        string certificateHash
    );

    // View functions
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
        );

    function getCertificate(
        uint256 tokenId
    ) external view returns (Certificate memory);

    function getCertificateRequest(
        uint256 requestId
    ) external view returns (CertificateRequest memory);

    function getRecipientCertificates(
        address recipient
    ) external view returns (uint256[] memory);

    function getValidator(
        address validator
    ) external view returns (Institution memory);

    function isActiveValidator(address validator) external view returns (bool);

    function totalCertificates() external view returns (uint256);

    function totalRequests() external view returns (uint256);
}
