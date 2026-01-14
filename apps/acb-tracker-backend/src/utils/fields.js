const GROUP_A_FIELDS = [
  "client",
  "flightNumber",
  "flightStatus",
  "etaEst",
  "etaStatus",
  "preAlertDate",
  "etaDate",
  "releaseDate",
  "releaseStatus",
  "port",
  "nameAddress",
  "lateSecured",
  "goodsDescription",
  "changeMAWB",
  "changeCounts",
  "mismatchValues",
  "awb",
  "clvs",
  "lvs",
  "pga",
  "total",
  "totalFoodItems",
  "analyst",
  "shipmentComments",
];

const GROUP_B_FIELDS = [
  "cadTransactionNumber",
  "cadTransNumStatus",
  "dutiesLvs",
  "taxesLvs",
  "dutiesPga",
  "taxesPga",
  "invoiceNumber",
  "billingDate",
  "billingClerk",
  "droppedToSftp",
  "billingComments",
];

const GROUP_C_FIELDS = ["activityLogs"];

const SYSTEM_FIELDS = [
  "_id",
  "version",
  "createdBy",
  "createdAt",
  "updatedBy",
  "updatedAt",
  "deletedAt",
  "deletedBy",
];

const ROLE_FIELDS_READ = {
  Admin: [...GROUP_A_FIELDS, ...GROUP_B_FIELDS, ...GROUP_C_FIELDS, ...SYSTEM_FIELDS],
  TL: [...GROUP_A_FIELDS, ...GROUP_B_FIELDS, ...GROUP_C_FIELDS, ...SYSTEM_FIELDS],
  Analyst: [...GROUP_A_FIELDS, ...SYSTEM_FIELDS],
  Billing: [...GROUP_A_FIELDS, ...GROUP_B_FIELDS, ...SYSTEM_FIELDS],
};

const ROLE_FIELDS_WRITE = {
  Admin: [...GROUP_A_FIELDS, ...GROUP_B_FIELDS, ...GROUP_C_FIELDS],
  TL: [...GROUP_A_FIELDS, ...GROUP_B_FIELDS, ...GROUP_C_FIELDS],
  Analyst: [...GROUP_A_FIELDS],
  Billing: [...GROUP_A_FIELDS, ...GROUP_B_FIELDS],
};

const ROLE_CAN_CREATE = ["Admin", "TL", "Analyst"];
const ROLE_CAN_DELETE = ["Admin", "TL"];
const ROLE_CAN_BULK_EDIT = ["Admin", "TL", "Billing"];

const ALLOWED_SORT_FIELDS = new Set([
  ...GROUP_A_FIELDS,
  ...GROUP_B_FIELDS,
  "createdAt",
  "updatedAt",
]);

module.exports = {
  GROUP_A_FIELDS,
  GROUP_B_FIELDS,
  GROUP_C_FIELDS,
  SYSTEM_FIELDS,
  ROLE_FIELDS_READ,
  ROLE_FIELDS_WRITE,
  ROLE_CAN_CREATE,
  ROLE_CAN_DELETE,
  ROLE_CAN_BULK_EDIT,
  ALLOWED_SORT_FIELDS,
};
