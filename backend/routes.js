const express = require("express");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const admin = require("./firebaseAdmin");
const { db, FieldValue } = require("./firestore");
const { SCHEMAS, normalizeBySchema, hasSchemaField } = require("./validation");
const { serializeDoc } = require("./utils");

function isCredentialsError(error) {
  const message = String(error?.message || "");
  return /credential|credentials|default credentials|invalid-credential/i.test(message);
}

function respondCredentialError(res) {
  return res.status(503).json({
    error:
      "Firebase credentials are not configured. Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS.",
  });
}

function applyTimestamps(schema, data, { isNew }) {
  const updates = {};
  if (isNew && hasSchemaField(schema, "createdAt")) {
    updates.createdAt = FieldValue.serverTimestamp();
  }
  if (hasSchemaField(schema, "updatedAt")) {
    updates.updatedAt = FieldValue.serverTimestamp();
  }
  return { ...data, ...updates };
}

async function listDocs(ref, limit) {
  const snapshot = await ref.limit(limit).get();
  return snapshot.docs.map(serializeDoc);
}

const VALID_ROLES = new Set(["quester", "questmaster", "superadmin"]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

function normalizeRole(role) {
  if (!role) {
    return "quester";
  }
  return VALID_ROLES.has(role) ? role : null;
}

function normalizeUsername(username) {
  return username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

async function signInWithPassword(email, password) {
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) {
    throw new Error("FIREBASE_WEB_API_KEY is not set.");
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || "Authentication failed";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

function formatUserId(number) {
  return `user-${String(number).padStart(4, "0")}`;
}

async function nextUserId() {
  const counterRef = db.collection("systemCounters").doc("users");

  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(counterRef);
    const nextNumber =
      snapshot.exists && typeof snapshot.data().nextNumber === "number"
        ? snapshot.data().nextNumber
        : 1;

    const userId = formatUserId(nextNumber);

    tx.set(
      counterRef,
      {
        nextNumber: nextNumber + 1,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return userId;
  });
}

function buildUserDocument({
  name,
  username,
  usernameNormalized,
  email,
  role,
  departmentId,
  categoryIds,
}) {
  const base = {
    name,
    username,
    usernameNormalized,
    email,
    role,
    departmentId: departmentId || "",
    categoryIds: Array.isArray(categoryIds) ? categoryIds : [],
    pendingRewardChoice: false,
    pendingRewardPoolId: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (role === "quester") {
    return {
      ...base,
      level: 1,
      currentExp: 0,
      gold: 0,
      rewardPoints: 0,
      personalPoints: 0,
    };
  }

  return {
    ...base,
    level: 0,
    currentExp: 0,
    gold: 0,
    rewardPoints: 0,
    personalPoints: 0,
  };
}

function createCollectionRouter(collectionName, schema) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
      const docs = await listDocs(db.collection(collectionName), limit);
      res.json(docs);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get("/:id", async (req, res) => {
    try {
      const docRef = db.collection(collectionName).doc(req.params.id);
      const snapshot = await docRef.get();
      if (!snapshot.exists) {
        return res.status(404).json({ error: "Not found" });
      }
      res.json(serializeDoc(snapshot));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const { data, errors } = normalizeBySchema(schema, req.body);
      if (errors.length) {
        return res.status(400).json({ errors });
      }
      const payload = applyTimestamps(schema, data, { isNew: true });
      const docRef = await db.collection(collectionName).add(payload);
      const created = await docRef.get();
      res.status(201).json(serializeDoc(created));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.put("/:id", async (req, res) => {
    try {
      const { data, errors } = normalizeBySchema(schema, req.body);
      if (errors.length) {
        return res.status(400).json({ errors });
      }
      const docRef = db.collection(collectionName).doc(req.params.id);
      const existing = await docRef.get();
      const payload = applyTimestamps(schema, data, { isNew: !existing.exists });
      await docRef.set(payload, { merge: true });
      const updated = await docRef.get();
      res.json(serializeDoc(updated));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.patch("/:id", async (req, res) => {
    try {
      const { data, errors } = normalizeBySchema(schema, req.body);
      if (errors.length) {
        return res.status(400).json({ errors });
      }
      const docRef = db.collection(collectionName).doc(req.params.id);
      const payload = applyTimestamps(schema, data, { isNew: false });
      await docRef.set(payload, { merge: true });
      const updated = await docRef.get();
      res.json(serializeDoc(updated));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      await db.collection(collectionName).doc(req.params.id).delete();
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

function createSubcollectionRouter(parentCollection, parentParam, subcollectionName, schema) {
  const router = express.Router({ mergeParams: true });

  const resolveCollection = (req) =>
    db.collection(parentCollection).doc(req.params[parentParam]).collection(subcollectionName);

  router.get("/", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
      const docs = await listDocs(resolveCollection(req), limit);
      res.json(docs);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get("/:id", async (req, res) => {
    try {
      const docRef = resolveCollection(req).doc(req.params.id);
      const snapshot = await docRef.get();
      if (!snapshot.exists) {
        return res.status(404).json({ error: "Not found" });
      }
      res.json(serializeDoc(snapshot));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const { data, errors } = normalizeBySchema(schema, req.body);
      if (errors.length) {
        return res.status(400).json({ errors });
      }
      const payload = applyTimestamps(schema, data, { isNew: true });
      const docRef = await resolveCollection(req).add(payload);
      const created = await docRef.get();
      res.status(201).json(serializeDoc(created));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.put("/:id", async (req, res) => {
    try {
      const { data, errors } = normalizeBySchema(schema, req.body);
      if (errors.length) {
        return res.status(400).json({ errors });
      }
      const docRef = resolveCollection(req).doc(req.params.id);
      const existing = await docRef.get();
      const payload = applyTimestamps(schema, data, { isNew: !existing.exists });
      await docRef.set(payload, { merge: true });
      const updated = await docRef.get();
      res.json(serializeDoc(updated));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.patch("/:id", async (req, res) => {
    try {
      const { data, errors } = normalizeBySchema(schema, req.body);
      if (errors.length) {
        return res.status(400).json({ errors });
      }
      const docRef = resolveCollection(req).doc(req.params.id);
      const payload = applyTimestamps(schema, data, { isNew: false });
      await docRef.set(payload, { merge: true });
      const updated = await docRef.get();
      res.json(serializeDoc(updated));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      await resolveCollection(req).doc(req.params.id).delete();
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

const router = express.Router();

router.post("/uploads", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "image file is required" });
    }

    const bucket = admin.storage().bucket();
    if (!bucket) {
      return res.status(500).json({ error: "Storage bucket is not configured" });
    }

    const ext = path.extname(req.file.originalname || "") || ".png";
    const token = crypto.randomUUID();
    const safeName = `${Date.now()}-${token}${ext}`;
    const filePath = `uploads/${req.user?.uid || "anonymous"}/${safeName}`;
    const file = bucket.file(filePath);

    await file.save(req.file.buffer, {
      contentType: req.file.mimetype,
      resumable: false,
      metadata: {
        metadata: {
          firebaseStorageDownloadTokens: token,
        },
      },
    });

    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
      filePath
    )}?alt=media&token=${token}`;

    return res.status(201).json({
      bucket: bucket.name,
      path: filePath,
      downloadUrl,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/auth/register", async (req, res) => {
  try {
    const { username, fullName, password, role, departmentId, categoryIds, email } = req.body || {};

    if (!fullName || typeof fullName !== "string") {
      return res.status(400).json({ error: "fullName is required" });
    }
    if (!username || typeof username !== "string") {
      return res.status(400).json({ error: "username is required" });
    }
    if (!password || typeof password !== "string") {
      return res.status(400).json({ error: "password is required" });
    }

    const normalizedRole = normalizeRole(role);
    if (!normalizedRole) {
      return res.status(400).json({
        error: "role must be one of: quester, questmaster, superadmin",
      });
    }

    const userIdCandidate = await nextUserId();
    const usernameNormalized = normalizeUsername(username);
    if (!usernameNormalized) {
      return res.status(400).json({ error: "username is invalid" });
    }

    const existingUsername = await db
      .collection("users")
      .where("usernameNormalized", "==", usernameNormalized)
      .limit(1)
      .get();
    if (!existingUsername.empty) {
      return res.status(409).json({ error: "Username already exists" });
    }

    const fallbackEmail = `${usernameNormalized}@exakt-arcade.local`;
    const userEmail = email && typeof email === "string" ? email : fallbackEmail;
    let authUser = null;
    let createdNew = false;

    try {
      authUser = await admin.auth().createUser({
        uid: userIdCandidate,
        email: userEmail,
        password,
        displayName: username,
      });
      createdNew = true;
    } catch (error) {
      if (isCredentialsError(error)) {
        return respondCredentialError(res);
      }
      if (error.code === "auth/configuration-not-found") {
        return res.status(400).json({
          error:
            "Firebase Auth is not configured. Enable Email/Password provider in Firebase Console.",
        });
      }
      if (error.code === "auth/email-already-exists") {
        const existingUser = await admin.auth().getUserByEmail(userEmail);
        authUser = await admin.auth().updateUser(existingUser.uid, {
          password,
          displayName: fullName,
        });
      } else if (error.code === "auth/uid-already-exists") {
        authUser = await admin.auth().updateUser(userIdCandidate, {
          password,
          displayName: fullName,
        });
      } else {
        throw error;
      }
    }

    const userId = authUser.uid;
    const userDoc = buildUserDocument({
      name: authUser.displayName || fullName,
      username,
      usernameNormalized,
      email: authUser.email || userEmail,
      role: normalizedRole,
      departmentId,
      categoryIds,
    });

    try {
      await db.collection("users").doc(userId).set(userDoc, { merge: true });
    } catch (error) {
      if (isCredentialsError(error)) {
        return respondCredentialError(res);
      }
      throw error;
    }

    return res.status(createdNew ? 201 : 200).json({
      userId,
      email: authUser.email || userEmail,
      name: authUser.displayName || fullName,
      role: normalizedRole,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { identifier, password } = req.body || {};

    if (!identifier || typeof identifier !== "string") {
      return res.status(400).json({ error: "identifier is required" });
    }
    if (!password || typeof password !== "string") {
      return res.status(400).json({ error: "password is required" });
    }

    let email = identifier;
    let resolvedUserId = null;
    let resolvedName = null;

    if (!identifier.includes("@")) {
      let userSnapshot;
      try {
        userSnapshot = await db.collection("users").doc(identifier).get();
      } catch (error) {
        if (isCredentialsError(error)) {
          return respondCredentialError(res);
        }
        throw error;
      }
      if (!userSnapshot.exists) {
        const usernameNormalized = normalizeUsername(identifier);
        let byUsername;
        try {
          byUsername = await db
            .collection("users")
            .where("usernameNormalized", "==", usernameNormalized)
            .limit(1)
            .get();
        } catch (error) {
          if (isCredentialsError(error)) {
            return respondCredentialError(res);
          }
          throw error;
        }
        if (byUsername.empty) {
          return res.status(404).json({ error: "User not found" });
        }
        userSnapshot = byUsername.docs[0];
      }
      const userData = userSnapshot.data() || {};
      if (!userData.email) {
        return res.status(400).json({ error: "User email is missing" });
      }
      email = userData.email;
      resolvedUserId = userSnapshot.id;
      resolvedName = userData.name || userData.fullName || null;
    }

    const authData = await signInWithPassword(email, password);
    const userId = resolvedUserId || authData.localId;
    let profile = null;
    try {
      const userSnapshot = await db.collection("users").doc(userId).get();
      profile = userSnapshot.exists ? serializeDoc(userSnapshot) : null;
    } catch (error) {
      if (isCredentialsError(error)) {
        return respondCredentialError(res);
      }
      throw error;
    }
    const name = resolvedName || profile?.name || null;

    return res.json({
      userId,
      email,
      name,
      idToken: authData.idToken,
      refreshToken: authData.refreshToken,
      profile,
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ error: error.message });
  }
});

router.use("/users", createCollectionRouter("users", SCHEMAS.users));
router.use(
  "/users/:userId/questAttempts",
  createSubcollectionRouter("users", "userId", "questAttempts", SCHEMAS.questAttempts)
);
router.use(
  "/users/:userId/attendanceLogs",
  createSubcollectionRouter("users", "userId", "attendanceLogs", SCHEMAS.attendanceLogs)
);
router.use(
  "/users/:userId/transactions",
  createSubcollectionRouter("users", "userId", "transactions", SCHEMAS.transactions)
);

router.use("/departments", createCollectionRouter("departments", SCHEMAS.departments));
router.use(
  "/departments/:departmentId/categories",
  createSubcollectionRouter("departments", "departmentId", "categories", SCHEMAS.categories)
);

router.use("/quests", createCollectionRouter("quests", SCHEMAS.quests));
router.use("/bonusQuests", createCollectionRouter("bonusQuests", SCHEMAS.bonusQuests));
router.use("/helpRequests", createCollectionRouter("helpRequests", SCHEMAS.helpRequests));
router.use("/levels", createCollectionRouter("levels", SCHEMAS.levels));
router.use("/rewardPools", createCollectionRouter("rewardPools", SCHEMAS.rewardPools));
router.use("/rewards", createCollectionRouter("rewards", SCHEMAS.rewards));
router.use("/attendanceConfig", createCollectionRouter("attendanceConfig", SCHEMAS.attendanceConfig));
router.use("/economyConfig", createCollectionRouter("economyConfig", SCHEMAS.economyConfig));
router.use("/conversionRequests", createCollectionRouter("conversionRequests", SCHEMAS.conversionRequests));
router.use("/deductionConfigs", createCollectionRouter("deductionConfigs", SCHEMAS.deductionConfigs));

module.exports = router;
