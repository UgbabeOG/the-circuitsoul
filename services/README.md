# CircuitSoul Services Folder

This directory hosts third-party open-source engines as Git Submodules.

- `services/n8n/` -> mapped to n8n repository (Flow engine)
- `services/ghost/` -> mapped to Ghost repository (Blog engine)
- `services/wazuh/` -> mapped to Wazuh repository (Shield engine)
- `services/prometheus/` -> mapped to Prometheus repository (Ops metrics engine)

All interactions are routed through `packages/api-adapters`. Direct DB access to these engines is strictly forbidden.
