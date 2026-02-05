const admin = require("./firebaseAdmin");

const db = admin.firestore();
const { FieldValue } = admin.firestore;

module.exports = { db, FieldValue };
