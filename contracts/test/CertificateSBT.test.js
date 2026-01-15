const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CertificateSBT", function () {
    let contract;
    let admin, validator, certificator, recipient;
    const INSTITUTION_ID = "INST-001";
    const INSTITUTION_NAME = "Universitas Test";

    beforeEach(async function () {
        [admin, validator, certificator, recipient] = await ethers.getSigners();

        const CertificateSBT = await ethers.getContractFactory("CertificateSBT");
        contract = await CertificateSBT.deploy();
        await contract.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should set deployer as admin", async function () {
            const ADMIN_ROLE = await contract.ADMIN_ROLE();
            expect(await contract.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
        });

        it("Should have zero certificates initially", async function () {
            expect(await contract.totalCertificates()).to.equal(0);
        });

        it("Should have zero requests initially", async function () {
            expect(await contract.totalRequests()).to.equal(0);
        });
    });

    describe("Validator Management", function () {
        it("Should allow admin to add validator", async function () {
            await expect(
                contract.addValidator(validator.address, INSTITUTION_ID, INSTITUTION_NAME)
            )
                .to.emit(contract, "ValidatorAdded")
                .withArgs(validator.address, INSTITUTION_ID, INSTITUTION_NAME);

            const validatorInfo = await contract.getValidator(validator.address);
            expect(validatorInfo.isActive).to.be.true;
            expect(validatorInfo.institutionId).to.equal(INSTITUTION_ID);
        });

        it("Should not allow non-admin to add validator", async function () {
            await expect(
                contract.connect(certificator).addValidator(
                    validator.address, INSTITUTION_ID, INSTITUTION_NAME
                )
            ).to.be.reverted;
        });

        it("Should not allow adding same validator twice", async function () {
            await contract.addValidator(validator.address, INSTITUTION_ID, INSTITUTION_NAME);

            await expect(
                contract.addValidator(validator.address, INSTITUTION_ID, INSTITUTION_NAME)
            ).to.be.revertedWith("Validator already exists");
        });

        it("Should allow admin to remove validator", async function () {
            await contract.addValidator(validator.address, INSTITUTION_ID, INSTITUTION_NAME);

            await expect(contract.removeValidator(validator.address))
                .to.emit(contract, "ValidatorRemoved")
                .withArgs(validator.address);

            expect(await contract.isActiveValidator(validator.address)).to.be.false;
        });

        it("Should allow admin to update validator", async function () {
            await contract.addValidator(validator.address, INSTITUTION_ID, INSTITUTION_NAME);

            const newId = "INST-002";
            const newName = "Institut Baru";

            await expect(contract.updateValidator(validator.address, newId, newName))
                .to.emit(contract, "ValidatorUpdated")
                .withArgs(validator.address, newId, newName);

            const validatorInfo = await contract.getValidator(validator.address);
            expect(validatorInfo.institutionId).to.equal(newId);
            expect(validatorInfo.name).to.equal(newName);
        });
    });

    describe("Certificate Requests", function () {
        const CERT_HASH = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
        const METADATA_URI = "http://localhost:8080/metadata/test.json";
        const CERT_TYPE = "diploma";

        it("Should allow anyone to submit certificate request", async function () {
            await expect(
                contract.connect(certificator).submitCertificateRequest(
                    recipient.address,
                    CERT_HASH,
                    METADATA_URI,
                    INSTITUTION_ID,
                    CERT_TYPE
                )
            )
                .to.emit(contract, "CertificateRequested")
                .withArgs(1, certificator.address, recipient.address, CERT_HASH, INSTITUTION_ID);

            expect(await contract.totalRequests()).to.equal(1);
        });

        it("Should not allow duplicate certificate hash", async function () {
            await contract.connect(certificator).submitCertificateRequest(
                recipient.address,
                CERT_HASH,
                METADATA_URI,
                INSTITUTION_ID,
                CERT_TYPE
            );

            await expect(
                contract.connect(certificator).submitCertificateRequest(
                    recipient.address,
                    CERT_HASH,
                    METADATA_URI,
                    INSTITUTION_ID,
                    CERT_TYPE
                )
            ).to.be.revertedWith("Certificate hash already used");
        });

        it("Should reject empty certificate hash", async function () {
            await expect(
                contract.connect(certificator).submitCertificateRequest(
                    recipient.address,
                    "",
                    METADATA_URI,
                    INSTITUTION_ID,
                    CERT_TYPE
                )
            ).to.be.revertedWith("Certificate hash required");
        });

        it("Should store request with pending status", async function () {
            await contract.connect(certificator).submitCertificateRequest(
                recipient.address,
                CERT_HASH,
                METADATA_URI,
                INSTITUTION_ID,
                CERT_TYPE
            );

            const request = await contract.getCertificateRequest(1);
            expect(request.status).to.equal(0); // Pending
            expect(request.recipient).to.equal(recipient.address);
            expect(request.certificator).to.equal(certificator.address);
        });
    });

    describe("Certificate Approval", function () {
        const CERT_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
        const METADATA_URI = "http://localhost:8080/metadata/test.json";
        const CERT_TYPE = "diploma";

        beforeEach(async function () {
            // Setup validator
            await contract.addValidator(validator.address, INSTITUTION_ID, INSTITUTION_NAME);

            // Submit request
            await contract.connect(certificator).submitCertificateRequest(
                recipient.address,
                CERT_HASH,
                METADATA_URI,
                INSTITUTION_ID,
                CERT_TYPE
            );
        });

        it("Should allow validator to approve and mint SBT", async function () {
            await expect(contract.connect(validator).approveCertificate(1))
                .to.emit(contract, "CertificateApproved")
                .to.emit(contract, "CertificateMinted");

            expect(await contract.totalCertificates()).to.equal(1);
            expect(await contract.balanceOf(recipient.address)).to.equal(1);
        });

        it("Should not allow non-validator to approve", async function () {
            await expect(
                contract.connect(certificator).approveCertificate(1)
            ).to.be.reverted;
        });

        it("Should not allow validator from different institution", async function () {
            // Add validator for different institution
            await contract.addValidator(admin.address, "INST-999", "Other University");

            await expect(
                contract.connect(admin).approveCertificate(1)
            ).to.be.revertedWith("Validator not from this institution");
        });

        it("Should not allow approving same request twice", async function () {
            await contract.connect(validator).approveCertificate(1);

            await expect(
                contract.connect(validator).approveCertificate(1)
            ).to.be.revertedWith("Request not pending");
        });
    });

    describe("Certificate Rejection", function () {
        const CERT_HASH = "0x9999567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
        const METADATA_URI = "http://localhost:8080/metadata/reject.json";
        const REJECTION_REASON = "Document verification failed";

        beforeEach(async function () {
            await contract.addValidator(validator.address, INSTITUTION_ID, INSTITUTION_NAME);

            await contract.connect(certificator).submitCertificateRequest(
                recipient.address,
                CERT_HASH,
                METADATA_URI,
                INSTITUTION_ID,
                "diploma"
            );
        });

        it("Should allow validator to reject request", async function () {
            await expect(
                contract.connect(validator).rejectCertificate(1, REJECTION_REASON)
            )
                .to.emit(contract, "CertificateRejected")
                .withArgs(1, validator.address, REJECTION_REASON);

            const request = await contract.getCertificateRequest(1);
            expect(request.status).to.equal(2); // Rejected
            expect(request.rejectionReason).to.equal(REJECTION_REASON);
        });

        it("Should not mint SBT on rejection", async function () {
            await contract.connect(validator).rejectCertificate(1, REJECTION_REASON);

            expect(await contract.totalCertificates()).to.equal(0);
            expect(await contract.balanceOf(recipient.address)).to.equal(0);
        });
    });

    describe("Certificate Verification", function () {
        const CERT_HASH = "0x7777567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

        beforeEach(async function () {
            await contract.addValidator(validator.address, INSTITUTION_ID, INSTITUTION_NAME);

            await contract.connect(certificator).submitCertificateRequest(
                recipient.address,
                CERT_HASH,
                "http://localhost:8080/metadata/verify.json",
                INSTITUTION_ID,
                "diploma"
            );

            await contract.connect(validator).approveCertificate(1);
        });

        it("Should verify valid certificate by hash", async function () {
            const [isValid, tokenId, recipientAddr, instId, mintedAt] =
                await contract.verifyCertificateByHash(CERT_HASH);

            expect(isValid).to.be.true;
            expect(tokenId).to.equal(1);
            expect(recipientAddr).to.equal(recipient.address);
            expect(instId).to.equal(INSTITUTION_ID);
            expect(mintedAt).to.be.gt(0);
        });

        it("Should return false for invalid hash", async function () {
            const [isValid] = await contract.verifyCertificateByHash("0xinvalidhash");
            expect(isValid).to.be.false;
        });

        it("Should get certificate by token ID", async function () {
            const cert = await contract.getCertificate(1);

            expect(cert.recipient).to.equal(recipient.address);
            expect(cert.certificateHash).to.equal(CERT_HASH);
            expect(cert.institutionId).to.equal(INSTITUTION_ID);
        });

        it("Should get recipient certificates", async function () {
            const certs = await contract.getRecipientCertificates(recipient.address);

            expect(certs.length).to.equal(1);
            expect(certs[0]).to.equal(1);
        });
    });

    describe("Soulbound Property", function () {
        const CERT_HASH = "0x5555567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

        beforeEach(async function () {
            await contract.addValidator(validator.address, INSTITUTION_ID, INSTITUTION_NAME);

            await contract.connect(certificator).submitCertificateRequest(
                recipient.address,
                CERT_HASH,
                "http://localhost:8080/metadata/soul.json",
                INSTITUTION_ID,
                "diploma"
            );

            await contract.connect(validator).approveCertificate(1);
        });

        it("Should not allow transfer of SBT", async function () {
            await expect(
                contract.connect(recipient).transferFrom(
                    recipient.address,
                    certificator.address,
                    1
                )
            ).to.be.revertedWith("Token is soulbound and cannot be transferred");
        });

        it("Should not allow safeTransferFrom", async function () {
            await expect(
                contract.connect(recipient)["safeTransferFrom(address,address,uint256)"](
                    recipient.address,
                    certificator.address,
                    1
                )
            ).to.be.revertedWith("Token is soulbound and cannot be transferred");
        });
    });
});
