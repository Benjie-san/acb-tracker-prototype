const clients = new Set();
const presence = new Map();

const writeEvent = (res, event, data) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

const broadcast = (event, data) => {
  clients.forEach((res) => {
    writeEvent(res, event, data);
  });
};

const snapshot = () =>
  Array.from(presence.entries()).map(([shipmentId, editors]) => ({
    shipmentId,
    editors: Array.from(editors.values()),
  }));

const beginPresence = (shipmentId, user) => {
  if (!shipmentId || !user) return;
  const key = String(shipmentId);
  const now = Date.now();
  const existing = presence.get(key) || new Map();
  existing.set(user.id, {
    userId: user.id,
    displayName: user.displayName,
    role: user.role,
    updatedAt: now,
  });
  presence.set(key, existing);
  broadcast("presence:update", {
    shipmentId: key,
    editors: Array.from(existing.values()),
  });
};

const endPresence = (shipmentId, userId) => {
  if (!shipmentId || !userId) return;
  const key = String(shipmentId);
  const existing = presence.get(key);
  if (!existing) return;
  existing.delete(userId);
  if (existing.size === 0) {
    presence.delete(key);
  }
  broadcast("presence:update", {
    shipmentId: key,
    editors: existing ? Array.from(existing.values()) : [],
  });
};

const addClient = (res) => {
  clients.add(res);
};

const removeClient = (res) => {
  clients.delete(res);
};

const EXPIRY_MS = 2 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  presence.forEach((editors, shipmentId) => {
    let changed = false;
    editors.forEach((editor, userId) => {
      if (!editor || now - editor.updatedAt > EXPIRY_MS) {
        editors.delete(userId);
        changed = true;
      }
    });
    if (editors.size === 0) {
      presence.delete(shipmentId);
      changed = true;
    }
    if (changed) {
      broadcast("presence:update", {
        shipmentId,
        editors: Array.from(editors.values()),
      });
    }
  });
}, 30000);

module.exports = {
  addClient,
  removeClient,
  snapshot,
  beginPresence,
  endPresence,
  writeEvent,
};
