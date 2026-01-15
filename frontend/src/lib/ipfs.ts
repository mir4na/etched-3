export async function uploadToIPFS(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);

    const metadata = JSON.stringify({
        name: `etched-cert-${Date.now()}`,
    });
    formData.append("pinataMetadata", metadata);

    const options = JSON.stringify({
        cidVersion: 1,
    });
    formData.append("pinataOptions", options);

    try {
        const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`,
            },
            body: formData,
        });

        if (!res.ok) {
            throw new Error(`Pinata upload failed: ${res.statusText}`);
        }

        const resData = await res.json();
        return `ipfs://${resData.IpfsHash}`;
    } catch (error) {
        console.error("IPFS Upload Error:", error);
        throw error;
    }
}

export function getGatewayUrl(ipfsUrl: string): string {
    if (!ipfsUrl) return "";
    const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || "https://gateway.pinata.cloud";
    return ipfsUrl.replace("ipfs://", `${gateway}/ipfs/`);
}
