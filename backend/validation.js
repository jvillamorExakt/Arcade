const SCHEMAS = {
  users: {
    name: "string",
    email: "string",
    role: "string",
    departmentId: "string",
    categoryIds: "string[]",
    level: "number",
    currentExp: "number",
    gold: "number",
    rewardPoints: "number",
    personalPoints: "number",
    pendingRewardChoice: "boolean",
    pendingRewardPoolId: "string|null",
    createdAt: "timestamp",
    updatedAt: "timestamp",
  },
  questAttempts: {
    questId: "string",
    status: "string",
    rewardPointsRemaining: "number",
    helpRequestId: "string|null",
    submittedAt: "timestamp|null",
    reviewedBy: "string|null",
    reviewedAt: "timestamp|null",
  },
  attendanceLogs: {
    date: "string",
    signInTime: "timestamp",
    isLate: "boolean",
    deductionApplied: "boolean",
  },
  transactions: {
    type: "string",
    goldChange: "number",
    pointChange: "number",
    reason: "string",
    createdAt: "timestamp",
  },
  departments: {
    name: "string",
  },
  categories: {
    name: "string",
  },
  quests: {
    title: "string",
    description: "string",
    departmentId: "string",
    categoryId: "string",
    difficulty: "string",
    duration: "number",
    imageUrl: "string",
    goldReward: "number",
    pointReward: "number",
    expReward: "number",
    deductionConfigId: "string",
    createdBy: "string",
    isBonus: "boolean",
    isActive: "boolean",
    createdAt: "timestamp",
  },
  bonusQuests: {
    title: "string",
    description: "string",
    eligibleDepartments: "string[]",
    imageUrl: "string",
    goldReward: "number",
    pointReward: "number",
    expReward: "number",
    createdBy: "string",
    expiresAt: "timestamp",
  },
  helpRequests: {
    questAttemptId: "string",
    requesterId: "string",
    helperId: "string",
    pointSharePercent: "number",
    status: "string",
    createdAt: "timestamp",
  },
  levels: {
    expRequired: "number",
    rewardPoolId: "string",
  },
  rewardPools: {
    level: "number",
    rewards: "string[]",
    imageUrl: "string",
  },
  rewards: {
    name: "string",
    type: "string",
    imageUrl: "string",
    value: "number",
  },
  attendanceConfig: {
    enabledDays: "string[]",
    graceMinutes: "number",
    latePenaltyPoints: "number",
  },
  economyConfig: {
    goldToPointRate: "number",
  },
  conversionRequests: {
    userId: "string",
    goldAmount: "number",
    pointsExpected: "number",
    status: "string",
    createdAt: "timestamp",
  },
  deductionConfigs: {
    failRewardPointDeduction: "number",
    failPersonalPointDeduction: "number",
    expFailMode: "string",
    expFailValue: "number",
  },
};

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeTimestamp(value) {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function normalizeValue(type, value) {
  const nullable = type.includes("|null");
  const baseType = type.replace("|null", "");

  if (value === null) {
    return nullable ? { value: null } : { error: "must not be null" };
  }

  const isArray = baseType.endsWith("[]");
  const coreType = isArray ? baseType.slice(0, -2) : baseType;

  if (isArray) {
    if (!Array.isArray(value)) {
      return { error: "must be an array" };
    }
    const errors = [];
    const normalized = value.map((item, index) => {
      const result = normalizeValue(coreType, item);
      if (result.error) {
        errors.push(`index ${index} ${result.error}`);
        return null;
      }
      return result.value;
    });
    if (errors.length) {
      return { error: errors.join(", ") };
    }
    return { value: normalized };
  }

  switch (coreType) {
    case "string":
      return typeof value === "string" ? { value } : { error: "must be a string" };
    case "number":
      return typeof value === "number" ? { value } : { error: "must be a number" };
    case "boolean":
      return typeof value === "boolean" ? { value } : { error: "must be a boolean" };
    case "timestamp": {
      const normalized = normalizeTimestamp(value);
      return normalized ? { value: normalized } : { error: "must be a valid timestamp" };
    }
    default:
      return { error: "has unknown schema type" };
  }
}

function normalizeBySchema(schema, payload) {
  if (!isPlainObject(payload)) {
    return { data: {}, errors: ["payload must be an object"] };
  }

  const data = {};
  const errors = [];

  Object.keys(schema).forEach((field) => {
    if (!(field in payload)) {
      return;
    }

    const result = normalizeValue(schema[field], payload[field]);
    if (result.error) {
      errors.push(`${field} ${result.error}`);
    } else {
      data[field] = result.value;
    }
  });

  return { data, errors };
}

function hasSchemaField(schema, field) {
  return Object.prototype.hasOwnProperty.call(schema, field);
}

module.exports = {
  SCHEMAS,
  normalizeBySchema,
  hasSchemaField,
};
