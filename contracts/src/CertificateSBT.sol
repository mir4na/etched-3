// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "./core/CertificateLogic.sol";


contract CertificateSBT is CertificateLogic {
    constructor() ERC721("Certificate Soulbound Token", "CERT-SBT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }
    

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal virtual override(ERC721) {
        require(
            from == address(0),
            "Token is soulbound and cannot be transferred"
        );
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
}
