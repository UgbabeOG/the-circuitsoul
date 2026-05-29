export const mockWazuh = {
  async getVulnerabilities(agentId: string) {
    console.log(`[MOCK WAZUH] Getting vulnerabilities for agent ${agentId}`);
    return [
      {
        id: "CVE-2023-44487",
        title: "HTTP/2 Rapid Reset Attack vulnerability",
        severity: "CRITICAL",
        description: "The HTTP/2 protocol allows a denial of service (server resource consumption) via a stream cancellation flood.",
        remediation: "Upgrade your web server configuration, apply patch CS-HTTP2-03, or configure rate limits on streams.",
        status: "OPEN"
      },
      {
        id: "CVE-2024-21626",
        title: "runc container breakout vulnerability",
        severity: "HIGH",
        description: "An issue in runc allows a containerized process to escape the container environment and access host file descriptors.",
        remediation: "Update runc to version 1.1.12 or newer on all container hosts.",
        status: "OPEN"
      },
      {
        id: "CVE-2023-38545",
        title: "curl SOCKS5 proxy handshake heap buffer overflow",
        severity: "MEDIUM",
        description: "This flaw makes curl overflow a heap-based buffer during a slow SOCKS5 handshake process.",
        remediation: "Update curl package to version 8.4.0 or newer.",
        status: "RESOLVED"
      }
    ];
  },

  async triggerScan(agentId: string) {
    console.log(`[MOCK WAZUH] Triggering manual posture scan on agent ${agentId}`);
    return {
      status: "SUCCESS",
      agentId,
      message: "Security posture assessment initiated successfully (Mock Mode)",
      scanTime: new Date().toISOString()
    };
  }
};
