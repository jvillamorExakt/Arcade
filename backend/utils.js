const admin = require("./firebaseAdmin");

function serializeValue(value) {
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item));
  }

  if (value && typeof value === "object") {
    const output = {};
    Object.entries(value).forEach(([key, child]) => {
      output[key] = serializeValue(child);
    });
    return output;
  }

  return value;
}

function serializeDoc(doc) {
  return {
    id: doc.id,
    ...serializeValue(doc.data()),
  };
}

module.exports = { serializeDoc };
