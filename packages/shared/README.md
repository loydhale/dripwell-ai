# @dripwell/shared

Shared types, utilities, and constants used across all DripWell.ai applications.

## Contents

- **Types**: Branded IDs (`TenantId`, `AssessmentId`, `ProviderId`), enums, interfaces
- **Prisma Schema**: Database schema definition (migrations in TASK-003)

## Usage

Import from sibling apps:

```ts
import { TenantId, makeTenantId } from '@dripwell/shared';
```
