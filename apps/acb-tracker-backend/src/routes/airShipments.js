const express = require("express");

const AirShipment = require("../models/AirShipment");
const { auth, requireRole } = require("../middleware/auth");
const {
  ROLE_FIELDS_READ,
  ROLE_FIELDS_WRITE,
  ROLE_CAN_CREATE,
  ROLE_CAN_DELETE,
  ROLE_CAN_BULK_EDIT,
  ALLOWED_SORT_FIELDS,
  GROUP_A_FIELDS,
} = require("../utils/fields");

const router = express.Router();

const pickAllowedFields = (input, allowedFields) => {
  const output = {};
  if (!input || typeof input !== "object") {
    return output;
  }

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      output[field] = input[field];
    }
  }
  return output;
};

const buildProjection = (role) => {
  const fields = ROLE_FIELDS_READ[role] || [];
  return fields.reduce((acc, field) => {
    acc[field] = 1;
    return acc;
  }, {});
};

const withUserLabels = (query) =>
  query
    .populate("createdBy", "displayName username")
    .populate("updatedBy", "displayName username");

const findMissingRequired = (payload) =>
  GROUP_A_FIELDS.filter((field) => {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) {
      return true;
    }
    const value = payload[field];
    if (value === null || value === undefined) {
      return true;
    }
    if (typeof value === "string" && !value.trim()) {
      return true;
    }
    return false;
  });

router.get("/", auth, async (req, res, next) => {
  try {
    const role = req.user.role;
    const projection = buildProjection(role);
    if (!Object.keys(projection).length) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 200);
    const requestedSort = req.query.sort;
    const sortField =
      requestedSort &&
      ALLOWED_SORT_FIELDS.has(requestedSort) &&
      projection[requestedSort]
        ? requestedSort
        : "createdAt";
    const order = req.query.order === "asc" ? 1 : -1;

    const filter = { deletedAt: null };
    if (req.query.q) {
      const pattern = new RegExp(req.query.q, "i");
      const searchFields = [
        "client",
        "flightNumber",
        "awb",
        "analyst",
        "invoiceNumber",
      ];
      const allowedSearchFields = searchFields.filter((field) => projection[field]);
      if (allowedSearchFields.length) {
        filter.$or = allowedSearchFields.map((field) => ({ [field]: pattern }));
      }
    }

    const [items, total] = await Promise.all([
      withUserLabels(
        AirShipment.find(filter)
          .select(projection)
          .sort({ [sortField]: order })
          .skip((page - 1) * limit)
          .limit(limit)
      ),
      AirShipment.countDocuments(filter),
    ]);

    return res.json({ items, total, page, limit });
  } catch (err) {
    return next(err);
  }
});

router.get("/export.xlsx", auth, async (req, res) => {
  return res.status(501).json({ error: "Export not implemented yet" });
});

router.get("/:id([0-9a-fA-F]{24})", auth, async (req, res, next) => {
  try {
    const role = req.user.role;
    const projection = buildProjection(role);
    if (!Object.keys(projection).length) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const item = await withUserLabels(
      AirShipment.findOne({
        _id: req.params.id,
        deletedAt: null,
      }).select(projection)
    );

    if (!item) {
      return res.status(404).json({ error: "Not found" });
    }

    return res.json({ item });
  } catch (err) {
    return next(err);
  }
});

router.post("/", auth, requireRole(ROLE_CAN_CREATE), async (req, res, next) => {
  try {
    const role = req.user.role;
    const writableFields = ROLE_FIELDS_WRITE[role] || [];
    const payload = pickAllowedFields(req.body, writableFields);
    if (!Object.keys(payload).length) {
      return res.status(400).json({ error: "No writable fields provided" });
    }
    const missingFields = findMissingRequired(payload);
    if (missingFields.length) {
      return res.status(400).json({
        error: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    const shipment = new AirShipment({
      ...payload,
      createdBy: req.user.id,
      updatedBy: req.user.id,
      version: 1,
    });
    await shipment.save();

    const projection = buildProjection(role);
    const item = await withUserLabels(
      AirShipment.findById(shipment._id).select(projection)
    );

    return res.status(201).json({ item });
  } catch (err) {
    return next(err);
  }
});

router.patch("/:id([0-9a-fA-F]{24})", auth, async (req, res, next) => {
  try {
    const role = req.user.role;
    const writableFields = ROLE_FIELDS_WRITE[role] || [];
    if (!writableFields.length) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { version, ...rest } = req.body || {};
    const versionNumber = Number(version);
    if (!Number.isInteger(versionNumber)) {
      return res.status(400).json({ error: "Version is required for updates" });
    }

    const patch = pickAllowedFields(rest, writableFields);
    if (!Object.keys(patch).length) {
      return res.status(400).json({ error: "No writable fields provided" });
    }

    const updated = await withUserLabels(
      AirShipment.findOneAndUpdate(
        { _id: req.params.id, version: versionNumber, deletedAt: null },
        {
          $set: {
            ...patch,
            updatedBy: req.user.id,
            updatedAt: new Date(),
          },
          $inc: { version: 1 },
        },
        { new: true, runValidators: true }
      ).select(buildProjection(role))
    );

    if (!updated) {
      const exists = await AirShipment.exists({
        _id: req.params.id,
        deletedAt: null,
      });
      if (!exists) {
        return res.status(404).json({ error: "Not found" });
      }
      return res.status(409).json({ error: "Version conflict" });
    }

    return res.json({ item: updated });
  } catch (err) {
    return next(err);
  }
});

router.delete(
  "/:id([0-9a-fA-F]{24})",
  auth,
  requireRole(ROLE_CAN_DELETE),
  async (req, res, next) => {
  try {
    const updated = await AirShipment.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      {
        $set: {
          deletedAt: new Date(),
          deletedBy: req.user.id,
          updatedBy: req.user.id,
          updatedAt: new Date(),
        },
        $inc: { version: 1 },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Not found" });
    }

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
  }
);

router.patch("/bulk", auth, requireRole(ROLE_CAN_BULK_EDIT), async (req, res, next) => {
  try {
    const role = req.user.role;
    const { ids, patch, versions } = req.body || {};

    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ error: "ids array is required" });
    }

    const writableFields = ROLE_FIELDS_WRITE[role] || [];
    const allowedPatch = pickAllowedFields(patch, writableFields);
    if (!Object.keys(allowedPatch).length) {
      return res.status(400).json({ error: "No writable fields provided" });
    }

    const results = [];
    for (const id of ids) {
      const filter = { _id: id, deletedAt: null };
      if (versions && versions[id] !== undefined) {
        const versionNumber = Number(versions[id]);
        if (Number.isInteger(versionNumber)) {
          filter.version = versionNumber;
        }
      }

      const updated = await AirShipment.findOneAndUpdate(
        filter,
        {
          $set: {
            ...allowedPatch,
            updatedBy: req.user.id,
            updatedAt: new Date(),
          },
          $inc: { version: 1 },
        },
        { new: true, runValidators: true }
      );

      if (!updated) {
        results.push({ id, status: "conflict_or_not_found" });
      } else {
        results.push({ id, status: "updated" });
      }
    }

    return res.json({ results });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
