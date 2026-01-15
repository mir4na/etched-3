// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "./core/CertificateLogic.sol";

/**
 * @title CertificateSBT
 * @dev Soulbound Token for certificates/diplomas
 * @notice Tokens are non-transferable once minted
 *
 * Architecture:
 * - ICertificateSBT: Interface defining types and events
 * - ValidatorRegistry: Handles admin -> validator workflow
 * - CertificateLogic: Handles certificate request -> approval -> minting
 * - CertificateSBT: Main contract with soulbound enforcement
 */
contract CertificateSBT is ERC721, CertificateLogic {
    constructor() ERC721("Certificate Soulbound Token", "CERT-SBT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // ============ Soulbound Override ============

    /**
     * @dev Override transfer to make token soulbound
     * @notice Tokens can only be minted, never transferred
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal virtual override {
        require(
            from == address(0),
            "Token is soulbound and cannot be transferred"
        );
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    // ============ Required Overrides ============

    function _burn(
        uint256 tokenId
    ) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
