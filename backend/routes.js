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
const ROLE_ALIASES = {
  member: "quester",
  questmaker: "questmaster",
  "quest maker": "questmaster",
  "quest master": "questmaster",
  superadmin: "superadmin",
  "super admin": "superadmin",
};
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

function normalizeRole(role) {
  if (!role) {
    return "quester";
  }
  const normalized = String(role).trim().toLowerCase();
  const mapped = ROLE_ALIASES[normalized] || normalized;
  return VALID_ROLES.has(mapped) ? mapped : null;
}

function normalizeRoleList(roles) {
  if (typeof roles === "string") {
    roles = roles
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(roles)) {
    return [];
  }
  const normalized = roles.map((role) => normalizeRole(role)).filter(Boolean);
  return Array.from(new Set(normalized));
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
  roles,
  departmentId,
  categoryIds,
}) {
  const roleList = normalizeRoleList(roles);
  const primaryRole = normalizeRole(role || roleList[0] || "quester");
  const base = {
    name,
    username,
    usernameNormalized,
    email,
    role: primaryRole,
    roles: roleList.length ? roleList : [primaryRole],
    departmentId: departmentId || "",
    categoryIds: Array.isArray(categoryIds) ? categoryIds : [],
    pendingRewardChoice: false,
    pendingRewardPoolId: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (primaryRole === "quester") {
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

async function fetchUserProfile(userId) {
  const snapshot = await db.collection("users").doc(userId).get();
  return snapshot.exists ? serializeDoc(snapshot) : null;
}

function matchesDepartment(quest, profile) {
  if (!profile?.departmentId) {
    return false;
  }
  if (quest.departmentId !== profile.departmentId) {
    return false;
  }
  if (!quest.categoryId) {
    return true;
  }
  const categoryIds = Array.isArray(profile.categoryIds) ? profile.categoryIds : [];
  return categoryIds.includes(quest.categoryId);
}

function normalizeAssignedUsers(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function extractUserRoles(user) {
  const roles = Array.isArray(user.roles)
    ? user.roles
    : typeof user.roles === "string"
      ? user.roles.split(",").map((role) => role.trim())
      : user.role
        ? [user.role]
        : [];
  return roles
    .map((role) => normalizeRole(role))
    .filter(Boolean)
    .map((role) => String(role).trim().toLowerCase());
}

function shouldExcludeFromLeaderboard(user) {
  const roles = extractUserRoles(user);
  return roles.includes("questmaster") || roles.includes("superadmin");
}

const leaderboardCache = {
  data: [],
  fetchedAt: 0,
  limit: 0,
};

function createQuestRouter() {
  const router = express.Router();

  router.get("/stats", async (req, res) => {
    try {
      const snapshot = await db.collection("quests").get();
      const totals = {
        totalQuests: 0,
        totalExpAwarded: 0,
        totalGoldAwarded: 0,
        active: 0,
        completed: 0,
        pending: 0,
      };

      snapshot.docs.forEach((doc) => {
        const data = doc.data() || {};
        totals.totalQuests += 1;
        totals.totalExpAwarded += Number(data.expReward || 0);
        totals.totalGoldAwarded += Number(data.goldReward || 0);
        if (data.status === "completed") {
          totals.completed += 1;
        } else if (data.status === "in_progress") {
          totals.active += 1;
        } else {
          totals.pending += 1;
        }
      });

      return res.json(totals);
    } catch (error) {
      if (isCredentialsError(error)) {
        return respondCredentialError(res);
      }
      return res.status(500).json({ error: error.message });
    }
  });

  router.get("/manage", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 200, 200);
      const docs = await listDocs(db.collection("quests"), limit);
      return res.json(docs);
    } catch (error) {
      if (isCredentialsError(error)) {
        return respondCredentialError(res);
      }
      return res.status(500).json({ error: error.message });
    }
  });

  router.get("/", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
      const view = req.query.view || "";
      const tab = req.query.tab || "open";

      if (view !== "board") {
        const docs = await listDocs(db.collection("quests"), limit);
        return res.json(docs);
      }

      const userId = req.user?.uid;
      const profile = await fetchUserProfile(userId);
      if (!profile) {
        return res.status(404).json({ error: "User profile not found" });
      }

      if (tab === "my") {
        const snapshot = await db
          .collection("quests")
          .where("assignedUserIds", "array-contains", userId)
          .limit(limit)
          .get();
        const docs = snapshot.docs.map(serializeDoc);
        const filtered = docs.filter((quest) => quest.questType !== "group");
        return res.json(filtered);
      }

      if (tab === "group") {
        const snapshot = await db
          .collection("quests")
          .where("questType", "==", "group")
          .where("isActive", "==", true)
          .limit(limit)
          .get();
        const docs = snapshot.docs.map(serializeDoc);
        const filtered = docs.filter((quest) => matchesDepartment(quest, profile));
        return res.json(filtered);
      }

      const snapshot = await db
        .collection("quests")
        .where("questType", "==", "open")
        .where("isActive", "==", true)
        .limit(limit)
        .get();
      const docs = snapshot.docs.map(serializeDoc);
      const filtered = docs.filter((quest) => {
        if (!matchesDepartment(quest, profile)) {
          return false;
        }
        const assigned = normalizeAssignedUsers(quest.assignedUserIds);
        if (assigned.length > 0) {
          return false;
        }
        return quest.status !== "completed";
      });
      return res.json(filtered);
    } catch (error) {
      if (isCredentialsError(error)) {
        return respondCredentialError(res);
      }
      return res.status(500).json({ error: error.message });
    }
  });

  router.get("/:id", async (req, res) => {
    try {
      const docRef = db.collection("quests").doc(req.params.id);
      const snapshot = await docRef.get();
      if (!snapshot.exists) {
        return res.status(404).json({ error: "Not found" });
      }
      return res.json(serializeDoc(snapshot));
    } catch (error) {
      if (isCredentialsError(error)) {
        return respondCredentialError(res);
      }
      return res.status(500).json({ error: error.message });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const { data, errors } = normalizeBySchema(SCHEMAS.quests, req.body);
      if (errors.length) {
        return res.status(400).json({ errors });
      }

      const userId = req.user?.uid || "";
      const profile = await fetchUserProfile(userId);
      const questType = data.questType || "open";

      const payload = {
        ...data,
        createdBy: data.createdBy || userId,
        departmentId: profile?.departmentId || data.departmentId || "",
        categoryId: data.categoryId || profile?.categoryIds?.[0] || "",
        questType,
        assignedUserIds: normalizeAssignedUsers(data.assignedUserIds),
        groupLimit: typeof data.groupLimit === "number" ? data.groupLimit : null,
        status: data.status || "open",
        isActive: typeof data.isActive === "boolean" ? data.isActive : true,
      };

      const payloadWithTimestamps = applyTimestamps(SCHEMAS.quests, payload, {
        isNew: true,
      });

      const docRef = await db.collection("quests").add(payloadWithTimestamps);
      const created = await docRef.get();
      return res.status(201).json(serializeDoc(created));
    } catch (error) {
      if (isCredentialsError(error)) {
        return respondCredentialError(res);
      }
      return res.status(500).json({ error: error.message });
    }
  });

  router.put("/:id", async (req, res) => {
    try {
      const { data, errors } = normalizeBySchema(SCHEMAS.quests, req.body);
      if (errors.length) {
        return res.status(400).json({ errors });
      }
      const docRef = db.collection("quests").doc(req.params.id);
      const existing = await docRef.get();
      const payload = applyTimestamps(SCHEMAS.quests, data, { isNew: !existing.exists });
      await docRef.set(payload, { merge: true });
      const updated = await docRef.get();
      return res.json(serializeDoc(updated));
    } catch (error) {
      if (isCredentialsError(error)) {
        return respondCredentialError(res);
      }
      return res.status(500).json({ error: error.message });
    }
  });

  router.patch("/:id", async (req, res) => {
    try {
      const { data, errors } = normalizeBySchema(SCHEMAS.quests, req.body);
      if (errors.length) {
        return res.status(400).json({ errors });
      }
      const docRef = db.collection("quests").doc(req.params.id);
      const payload = applyTimestamps(SCHEMAS.quests, data, { isNew: false });
      await docRef.set(payload, { merge: true });
      const updated = await docRef.get();
      return res.json(serializeDoc(updated));
    } catch (error) {
      if (isCredentialsError(error)) {
        return respondCredentialError(res);
      }
      return res.status(500).json({ error: error.message });
    }
  });

  router.post("/:id/claim", async (req, res) => {
    const userId = req.user?.uid || "";
    const docRef = db.collection("quests").doc(req.params.id);

    try {
      const profile = await fetchUserProfile(userId);
      if (!profile) {
        return res.status(404).json({ error: "User profile not found" });
      }

      await db.runTransaction(async (tx) => {
        const snapshot = await tx.get(docRef);
        if (!snapshot.exists) {
          const error = new Error("Not found");
          error.status = 404;
          throw error;
        }
        const data = snapshot.data() || {};
        if (!matchesDepartment(data, profile)) {
          const error = new Error("Forbidden");
          error.status = 403;
          throw error;
        }
        if (data.questType !== "open") {
          const error = new Error("Quest is not open");
          error.status = 400;
          throw error;
        }
        const assigned = normalizeAssignedUsers(data.assignedUserIds);
        if (assigned.length > 0 && !assigned.includes(userId)) {
          const error = new Error("Quest already claimed");
          error.status = 409;
          throw error;
        }
        const updates = {
          assignedUserIds: [userId],
          status: data.status === "open" ? "in_progress" : data.status,
          updatedAt: FieldValue.serverTimestamp(),
        };
        tx.set(docRef, updates, { merge: true });
      });

      const updated = await docRef.get();
      return res.json(serializeDoc(updated));
    } catch (error) {
      if (isCredentialsError(error)) {
        return respondCredentialError(res);
      }
      const status = error.status || 500;
      return res.status(status).json({ error: error.message });
    }
  });

  router.post("/:id/join", async (req, res) => {
    const userId = req.user?.uid || "";
    const docRef = db.collection("quests").doc(req.params.id);

    try {
      const profile = await fetchUserProfile(userId);
      if (!profile) {
        return res.status(404).json({ error: "User profile not found" });
      }

      await db.runTransaction(async (tx) => {
        const snapshot = await tx.get(docRef);
        if (!snapshot.exists) {
          const error = new Error("Not found");
          error.status = 404;
          throw error;
        }
        const data = snapshot.data() || {};
        if (!matchesDepartment(data, profile)) {
          const error = new Error("Forbidden");
          error.status = 403;
          throw error;
        }
        if (data.questType !== "group") {
          const error = new Error("Quest is not a group quest");
          error.status = 400;
          throw error;
        }
        const assigned = normalizeAssignedUsers(data.assignedUserIds);
        if (assigned.includes(userId)) {
          return;
        }
        if (typeof data.groupLimit === "number" && assigned.length >= data.groupLimit) {
          const error = new Error("Group is already full");
          error.status = 409;
          throw error;
        }
        const updates = {
          assignedUserIds: [...assigned, userId],
          status: data.status === "open" ? "in_progress" : data.status,
          updatedAt: FieldValue.serverTimestamp(),
        };
        tx.set(docRef, updates, { merge: true });
      });

      const updated = await docRef.get();
      return res.json(serializeDoc(updated));
    } catch (error) {
      if (isCredentialsError(error)) {
        return respondCredentialError(res);
      }
      const status = error.status || 500;
      return res.status(status).json({ error: error.message });
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      await db.collection("quests").doc(req.params.id).delete();
      return res.status(204).end();
    } catch (error) {
      if (isCredentialsError(error)) {
        return respondCredentialError(res);
      }
      return res.status(500).json({ error: error.message });
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
    const { username, fullName, password, role, roles, departmentId, categoryIds, email } =
      req.body || {};

    if (!fullName || typeof fullName !== "string") {
      return res.status(400).json({ error: "fullName is required" });
    }
    if (!username || typeof username !== "string") {
      return res.status(400).json({ error: "username is required" });
    }
    if (!password || typeof password !== "string") {
      return res.status(400).json({ error: "password is required" });
    }

    const normalizedRoles = normalizeRoleList(roles);
    const normalizedRole = normalizeRole(role || normalizedRoles[0]);
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
      roles: normalizedRoles,
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
      roles: userDoc.roles || [normalizedRole],
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

router.get("/dashboard/quest-stats", async (req, res) => {
  const userId = req.user?.uid;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const profile = await fetchUserProfile(userId);
    if (!profile) {
      return res.status(404).json({ error: "User profile not found" });
    }

    const [questSnapshot, attemptSnapshot] = await Promise.all([
      db.collection("quests").get(),
      db.collection("users").doc(userId).collection("questAttempts").get(),
    ]);

    const attemptStatusByQuest = new Map();
    attemptSnapshot.docs.forEach((doc) => {
      const attempt = doc.data() || {};
      if (!attempt.questId) return;
      attemptStatusByQuest.set(
        String(attempt.questId),
        String(attempt.status || "").toLowerCase(),
      );
    });

    const stats = { completed: 0, active: 0, pending: 0 };

    questSnapshot.docs.forEach((doc) => {
      const quest = doc.data() || {};
      const status = String(quest.status || "").toLowerCase();
      const assigned = normalizeAssignedUsers(quest.assignedUserIds);
      const isAssigned = assigned.includes(userId);
      const questType = quest.questType || "open";
      const matches = matchesDepartment(quest, profile);
      const isActive = quest.isActive !== false;
      const attemptStatus = attemptStatusByQuest.get(doc.id) || "";

      if (attemptStatus === "completed") {
        stats.completed += 1;
        return;
      }

      if (attemptStatus === "in_progress") {
        stats.active += 1;
        return;
      }

      const canSeeOpen = questType === "open" && matches && isActive;
      const canSeeGroup = questType === "group" && matches && isActive;
      const canSeeSpecific = questType === "specific" && isAssigned && isActive;

      const groupNotFull =
        typeof quest.groupLimit === "number" ? assigned.length < quest.groupLimit : true;

      if (status === "open") {
        if (canSeeOpen && assigned.length === 0) {
          stats.pending += 1;
          return;
        }
        if (canSeeGroup && !isAssigned && groupNotFull) {
          stats.pending += 1;
          return;
        }
        if (canSeeSpecific) {
          stats.pending += 1;
          return;
        }
      }
    });

    return res.json(stats);
  } catch (error) {
    if (isCredentialsError(error)) {
      return respondCredentialError(res);
    }
    return res.status(500).json({ error: error.message });
  }
});

router.get("/leaderboard", async (req, res) => {
  try {
    const requestedLimit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
    const now = Date.now();
    if (leaderboardCache.data.length && now - leaderboardCache.fetchedAt < 30000) {
      return res.json(leaderboardCache.data.slice(0, requestedLimit));
    }

    const queryLimit = Math.min(requestedLimit * 3, 200);
    const snapshot = await db
      .collection("users")
      .orderBy("currentExp", "desc")
      .limit(queryLimit)
      .get();

    const results = snapshot.docs
      .map((doc) => serializeDoc(doc))
      .filter((user) => !shouldExcludeFromLeaderboard(user))
      .map((user, index) => ({
        id: user.id,
        name: user.name || user.username || user.id,
        currentExp: Number(user.currentExp || 0),
        rank: index + 1,
      }));

    leaderboardCache.data = results;
    leaderboardCache.fetchedAt = now;
    leaderboardCache.limit = queryLimit;

    return res.json(results.slice(0, requestedLimit));
  } catch (error) {
    if (isCredentialsError(error)) {
      return respondCredentialError(res);
    }
    return res.status(500).json({ error: error.message });
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

router.use("/quests", createQuestRouter());
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
