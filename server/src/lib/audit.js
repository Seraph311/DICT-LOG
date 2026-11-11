export async function writeAudit(client, { actorId, action, entity, entityId, details }) {
  await client.query(
    `INSERT INTO audit_log (actor_id, action, entity, entity_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [actorId, action, entity, String(entityId), JSON.stringify(details ?? {})],
  );
}
