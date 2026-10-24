import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getDb } from '../lib/db';
import type { ClinicActor } from '../lib/auth';
import { validateSetupLocation } from '../lib/recordings';
import { verifiedOwner } from '../agent/lib/scope';

const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl) process.env.DATABASE_URL = testUrl;
const suite = testUrl ? describe : describe.skip;

suite('setup scope against isolated PostgreSQL', { concurrency: false }, () => {
  let actor: ClinicActor;
  let selectedLocationId: string;
  let foreignLocationId: string;
  let sessionId: string;
  let legacySessionId: string;
  const tenantIds: string[] = [];

  before(async () => {
    const db = getDb();
    const suffix = randomUUID();
    const tenant = await db.tenant.create({
      data: {
        name: 'Synthetic owner scope',
        slug: `scope-${suffix}`,
        state: 'TEST',
        medicalDirector: 'Synthetic test director',
      },
    });
    const foreign = await db.tenant.create({
      data: {
        name: 'Synthetic foreign scope',
        slug: `scope-foreign-${suffix}`,
        state: 'TEST',
        medicalDirector: 'Synthetic test director',
      },
    });
    tenantIds.push(tenant.id, foreign.id);
    const firstLocation = await db.location.create({
      data: { tenantId: tenant.id, name: 'First synthetic location' },
    });
    const selectedLocation = await db.location.create({
      data: { tenantId: tenant.id, name: 'Second selected synthetic location' },
    });
    const foreignLocation = await db.location.create({
      data: { tenantId: foreign.id, name: 'Foreign synthetic location' },
    });
    selectedLocationId = selectedLocation.id;
    foreignLocationId = foreignLocation.id;
    const owner = await db.user.create({
      data: {
        tenantId: tenant.id,
        email: `scope-${suffix}@example.test`,
        passwordHash: 'unusable-synthetic-password',
        firstName: 'Synthetic',
        lastName: 'Owner',
        role: 'SUPER_USER',
      },
    });
    actor = {
      id: owner.id,
      userId: owner.id,
      tenantId: tenant.id,
      tenant,
      locationId: firstLocation.id,
      email: owner.email,
      firstName: owner.firstName,
      lastName: owner.lastName,
      role: owner.role,
      canApproveClinical: false,
      mfaEnabled: false,
      mfaVerified: false,
      mfaVerifiedAt: null,
      sessionId: randomUUID(),
    };
    sessionId = `synthetic-eve:${randomUUID()}`;
    legacySessionId = `synthetic-legacy-eve:${randomUUID()}`;
    await db.setupConversation.createMany({
      data: [
        {
          tenantId: tenant.id,
          userId: owner.id,
          locationId: selectedLocation.id,
          eveSessionId: sessionId,
        },
        { tenantId: tenant.id, userId: owner.id, locationId: null, eveSessionId: legacySessionId },
      ],
    });
  });

  after(async () => {
    const db = getDb();
    for (const tenantId of tenantIds) {
      await db.setupConversation.deleteMany({ where: { tenantId } });
      await db.user.deleteMany({ where: { tenantId } });
      await db.location.deleteMany({ where: { tenantId } });
      await db.tenant.delete({ where: { id: tenantId } });
    }
    await db.$disconnect();
  });

  function context(locationId: string, id = sessionId) {
    const value = {
      session: {
        id,
        auth: {
          current: {
            principalType: 'user',
            authenticator: 'dripwell-session',
            principalId: `${actor.tenantId}/${actor.userId}`,
            attributes: { tenantId: actor.tenantId, userId: actor.userId, locationId },
          },
        },
      },
    };
    return value as unknown as Parameters<typeof verifiedOwner>[0];
  }

  it('uses the selected second location and rejects another tenant or staff authority', async () => {
    assert.equal(await validateSetupLocation(actor, selectedLocationId), selectedLocationId);
    await assert.rejects(validateSetupLocation(actor, foreignLocationId), {
      code: 'LOCATION_NOT_FOUND',
    });
    await assert.rejects(validateSetupLocation({ ...actor, role: 'STAFF' }, selectedLocationId), {
      code: 'OWNER_REQUIRED',
    });
  });

  it('requires the durable session to bind the same tenant, owner and selected location', async () => {
    assert.equal((await verifiedOwner(context(selectedLocationId))).locationId, selectedLocationId);
    await assert.rejects(
      verifiedOwner(context(actor.locationId)),
      /SETUP_LOCATION_BINDING_REQUIRED/,
    );
    await assert.rejects(
      verifiedOwner(context(foreignLocationId)),
      /LOCATION_AUTHORIZATION_REQUIRED/,
    );
    await assert.rejects(
      verifiedOwner(context(selectedLocationId, legacySessionId)),
      /SETUP_LOCATION_BINDING_REQUIRED/,
    );
  });

  it('rechecks active owner authority before a session tool or memory recall', async () => {
    await getDb().user.update({ where: { id: actor.userId }, data: { isActive: false } });
    await assert.rejects(verifiedOwner(context(selectedLocationId)), /OWNER_AUTHORIZATION_REVOKED/);
    await getDb().user.update({ where: { id: actor.userId }, data: { isActive: true } });
  });
});
