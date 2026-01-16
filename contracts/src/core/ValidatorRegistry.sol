// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/ICertificateSBT.sol";


abstract contract ValidatorRegistry is AccessControl, ICertificateSBT {
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");

    
    mapping(address => Institution) internal _validators;
    mapping(string => address[]) internal _institutionValidators;

    

    
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

    
    function removeValidator(address validator) external onlyRole(ADMIN_ROLE) {
        require(_validators[validator].isActive, "Validator not found");

        _validators[validator].isActive = false;
        _revokeRole(VALIDATOR_ROLE, validator);

        emit ValidatorRemoved(validator);
    }

    
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

    

    
    function getValidator(
        address validator
    ) external view returns (Institution memory) {
        return _validators[validator];
    }

    
    function isActiveValidator(address validator) external view returns (bool) {
        return _validators[validator].isActive;
    }

    
    function getInstitutionValidators(
        string memory institutionId
    ) external view returns (address[] memory) {
        return _institutionValidators[institutionId];
    }

    

    
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
