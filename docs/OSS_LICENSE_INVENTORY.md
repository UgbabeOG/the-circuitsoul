# CircuitSoul Open Source License Inventory

**Branch:** `hardening/stage1-security-remediation`  
**Date:** 2026-11-02

## Purpose

CircuitSoul builds on established open-source infrastructure. For every external project, this document records the license, commercial use restrictions, and CircuitSoul's intended use. The architecture follows:

```
Customer Interface
↓
CircuitSoul API
↓
CircuitSoul Business Logic
↓
CircuitSoul Adapter Layer
↓
Open-source Infrastructure Engine
```

CircuitSoul owns the customer experience, product logic, AI intelligence, reporting, business workflows, and multi-tenant architecture. Open-source engines are isolated behind CircuitSoul adapters.

## Inventory

### 1. n8n — Workflow Automation Engine

| Field | Value |
|-------|-------|
| **Project** | n8n |
| **Official Repository** | https://github.com/n8n-io/n8n |
| **Version** | `n8nio/n8n:latest` (unpinned in docker-compose) |
| **License** | Fair Code License (n8n Fair Code License) — NOT OSI Open Source |
| **Official License Source** | https://github.com/n8n-io/n8n/blob/master/license.md |
| **Commercial Use Restrictions** | **RESTRICTED.** The n8n Fair Code License restricts commercial SaaS use. Using n8n as the execution engine for a commercial SaaS platform may require a commercial license from n8n. |
| **Modification Obligations** | Modifications to n8n source must be made available under the same license if distributed |
| **Redistribution Obligations** | Source must be made available if the modified software is distributed |
| **SaaS/Hosted-Product Restrictions** | Cannot offer n8n as a managed service without a commercial license |
| **CircuitSoul's Intended Use** | n8n is used as the workflow execution engine for CircuitSoul Flow. CircuitSoul wraps n8n behind adapters and does not modify n8n source. CircuitSoul does not offer n8n as a standalone service. |
| **Decision** | **Requires Legal Review.** Must verify n8n's commercial licensing conditions before production use. Consider alternatives (Windmill, ActivePieces, custom worker) if commercial license is cost-prohibitive. |

### 2. Ghost — CMS / Blog Publishing Engine

| Field | Value |
|-------|-------|
| **Project** | Ghost |
| **Official Repository** | https://github.com/TryGhost/Ghost |
| **Version** | `ghost:5-alpine` (pinned to major version) |
| **License** | MIT (Ghost core) / AGPLv3 (some components) |
| **Official License Source** | https://github.com/TryGhost/Ghost/blob/main/LICENSE |
| **Commercial Use Restrictions** | Permissive for use as a backend API. AGPL components require source disclosure if modified and distributed. |
| **Modification Obligations** | If Ghost source is modified, modifications must be released under the same license |
| **Redistribution Obligations** | Source must be made available if the modified software is distributed |
| **SaaS/Hosted-Product Restrictions** | Using Ghost as a headless CMS backend via API is permitted without source disclosure |
| **CircuitSoul's Intended Use** | CircuitSoul uses Ghost Admin API v5 for blog publishing. CircuitSoul does not modify Ghost source. Ghost is accessed server-side only through `@circuitsoul/api-adapters`. |
| **Decision** | **Approved.** Using Ghost as a headless CMS backend via Admin API does not trigger AGPL source disclosure obligations. |

### 3. Wazuh — Security Monitoring & SIEM

| Field | Value |
|-------|-------|
| **Project** | Wazuh |
| **Official Repository** | https://github.com/wazuh/wazuh |
| **Version** | `wazuh/wazuh-odfe:4.3.10` (outdated, EOL) |
| **License** | GPLv2 |
| **Official License Source** | https://github.com/wazuh/wazuh/blob/master/LICENSE |
| **Commercial Use Restrictions** | GPLv2 permits commercial use. If Wazuh is modified and distributed, source must be released under GPLv2. |
| **Modification Obligations** | Modifications to Wazuh source must be released under GPLv2 if distributed |
| **Redistribution Obligations** | Source must be made available if the modified software is distributed |
| **SaaS/Hosted-Product Restrictions** | Using Wazuh as a backend API for security scanning is permitted without source disclosure (no modification) |
| **CircuitSoul's Intended Use** | CircuitSoul uses Wazuh API for vulnerability scanning through `@circuitsoul/api-adapters`. CircuitSoul does not modify Wazuh source. |
| **Decision** | **Approved for use, requires image upgrade.** `wazuh/wazuh-odfe:4.3.10` is based on OpenDistro for Elasticsearch (EOL). Current Wazuh uses a different architecture (indexer + dashboard + server). Must upgrade to a supported Wazuh version. |

### 4. Prometheus — Monitoring & Time-Series Database

| Field | Value |
|-------|-------|
| **Project** | Prometheus |
| **Official Repository** | https://github.com/prometheus/prometheus |
| **Version** | `prom/prometheus:latest` (unpinned) |
| **License** | Apache License 2.0 |
| **Official License Source** | https://github.com/prometheus/prometheus/blob/main/LICENSE |
| **Commercial Use Restrictions** | Permissive. No restrictions on commercial use or SaaS offerings. |
| **Modification Obligations** | None (Apache 2.0 does not require source disclosure for modifications) |
| **Redistribution Obligations** | Must include license and copyright notice if redistributing |
| **SaaS/Hosted-Product Restrictions** | None |
| **CircuitSoul's Intended Use** | CircuitSoul uses Prometheus query API for infrastructure metrics through `@circuitsoul/api-adapters`. CircuitSoul does not modify Prometheus source. |
| **Decision** | **Approved.** Apache 2.0 is permissive and suitable for commercial SaaS use. |

### 5. PostgreSQL — Primary Database

| Field | Value |
|-------|-------|
| **Project** | PostgreSQL |
| **Official Repository** | https://github.com/postgres/postgres |
| **Version** | `postgres:16-alpine` |
| **License** | PostgreSQL License (MIT-like) |
| **Official License Source** | https://www.postgresql.org/about/licence/ |
| **Commercial Use Restrictions** | None. Permissive for commercial use. |
| **Decision** | **Approved.** |

### 6. Redis — Message Broker / Cache

| Field | Value |
|-------|-------|
| **Project** | Redis |
| **Official Repository** | https://github.com/redis/redis |
| **Version** | `redis:7-alpine` |
| **License** | Redis Source Available License (RSALv2) / BSD-3-Clause (older versions) |
| **Official License Source** | https://github.com/redis/redis/blob/7.0/LICENSE |
| **Commercial Use Restrictions** | RSALv2 restricts offering Redis as a managed service. Using Redis as a cache/message broker for CircuitSoul's own application is permitted. |
| **Decision** | **Approved.** CircuitSoul uses Redis for BullMQ queues internally, not as a managed service offering. |

### 7. npm Dependencies (Selected)

| Package | License | Commercial Use | Decision |
|---------|---------|----------------|----------|
| `next` | MIT | Permissive | Approved |
| `react` | MIT | Permissive | Approved |
| `prisma` | Apache 2.0 | Permissive | Approved |
| `@prisma/client` | Apache 2.0 | Permissive | Approved |
| `bullmq` | MIT | Permissive | Approved |
| `axios` | MIT | Permissive | Approved |
| `pdfkit` | MIT | Permissive | Approved |
| `@aws-sdk/client-s3` | Apache 2.0 | Permissive | Approved |
| `openai` | MIT | Permissive | Approved |
| `zod` | MIT | Permissive | Approved |
| `@opentelemetry/*` | Apache 2.0 | Permissive | Approved |

## License Compliance Summary

| Category | Count | Status |
|----------|-------|--------|
| Permissive (MIT, Apache 2.0, BSD, PostgreSQL) | 14+ | Approved |
| Copyleft (GPLv2) | 1 (Wazuh) | Approved (no modification) |
| Fair Code / Restricted | 1 (n8n) | **Requires Legal Review** |
| Source Available (Redis RSALv2) | 1 | Approved (internal use only) |

## Required Actions

1. **n8n License Review:** Before production deployment, obtain legal review of n8n's Fair Code License for commercial SaaS use. Consider obtaining a commercial n8n license or switching to an alternative engine.

2. **Wazuh Image Upgrade:** Replace `wazuh/wazuh-odfe:4.3.10` (EOL) with a currently supported Wazuh image.

3. **Pin Docker Versions:** Replace `latest` tags with specific version digests for n8n and Prometheus.

4. **Document All Modifications:** If any OSS engine source is modified, document the changes and comply with license obligations (GPLv2 source disclosure for Wazuh, etc.).

5. **No White-Labeling of OSS Engines:** CircuitSoul must not rebrand or resell OSS engine dashboards directly to customers. All engine access must be through CircuitSoul adapters with CircuitSoul's own UI/UX.
