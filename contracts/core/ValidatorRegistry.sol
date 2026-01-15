// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/ICertificateSBT.sol";

/**
 * @title ValidatorRegistry
 * @dev Manages validator registration and institution verification
 * @notice Handles the admin -> validator verification workflow
 */
abstract contract ValidatorRegistry is AccessControl, ICertificateSBT {
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");

    // Storage
    mapping(address => Institution) internal _validators;
    mapping(string => address[]) internal _institutionValidators;

    // ============ Admin Functions ============

    /**
     * @dev Add a new validator from an institution
     * @param validator Address of the validator
     * @param institutionId Unique institution identifier
     * @param institutionName Name of the institution
     */
    function addValidator(
        address validator,
        string memory institutionId,
        string memory institutionName
    ) external onlyRole(ADMIN_ROLE) {
        require(validator != address(0), "Invalid validator address");
        require(bytes(institutionId).length > 0, "Institution ID required");
        require(!_validators[validator].isActive, "Validator already exists");

        _validators[validator] = Institution({
            name: institutionName,
            institutionId: institutionId,
            isActive: true,
            registeredAt: block.timestamp
        });

        _institutionValidators[institutionId].push(validator);
        _grantRole(VALIDATOR_ROLE, validator);

        emit ValidatorAdded(validator, institutionId, institutionName);
    }

    /**
     * @dev Remove a validator
     * @param validator Address of the validator to remove
     */
    function removeValidator(address validator) external onlyRole(ADMIN_ROLE) {
        require(_validators[validator].isActive, "Validator not found");

        _validators[validator].isActive = false;
        _revokeRole(VALIDATOR_ROLE, validator);

        emit ValidatorRemoved(validator);
    }

    /**
     * @dev Update validator institution info
     */
    function updateValidator(
        address validator,
        string memory institutionId,
        string memory institutionName
    ) external onlyRole(ADMIN_ROLE) {
        require(_validators[validator].isActive, "Validator not found");

        _validators[validator].institutionId = institutionId;
        _validators[validator].name = institutionName;

        emit ValidatorUpdated(validator, institutionId, institutionName);
    }

    // ============ View Functions ============

    /**
     * @dev Get validator info
     */
    function getValidator(
        address validator
    ) external view returns (Institution memory) {
        return _validators[validator];
    }

    /**
     * @dev Check if address is active validator
     */
    function isActiveValidator(address validator) external view returns (bool) {
        return _validators[validator].isActive;
    }

    /**
     * @dev Get validators for an institution
     */
    function getInstitutionValidators(
        string memory institutionId
    ) external view returns (address[] memory) {
        return _institutionValidators[institutionId];
    }

    // ============ Internal Functions ============

    /**
     * @dev Check if validator belongs to institution
     */
    function _isValidatorForInstitution(
        address validator,
        string memory institutionId
    ) internal view returns (bool) {
        return
            _validators[validator].isActive &&
            keccak256(bytes(_validators[validator].institutionId)) ==
            keccak256(bytes(institutionId));
    }
}
