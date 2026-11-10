// Centralized list of application permissions.
// These are PERMISSIONS (what an action can do), NOT organizational positions
// (Positions are configured per-organization and map to a set of these permissions).

const PERMISSIONS = [
  'CREATE_COMPLAINT',
  'VIEW_OWN_COMPLAINT',
  'VIEW_ASSIGNED_COMPLAINT',
  'VIEW_ALL_COMPLAINTS',
  'ACKNOWLEDGE_COMPLAINT',
  'START_COMPLAINT',
  'ADD_REMARK',
  'RESOLVE_COMPLAINT',
  'CANCEL_COMPLAINT',
  'MANUAL_ESCALATE',
  'MANAGE_USERS',
  'MANAGE_DEPARTMENTS',
  'MANAGE_ROLES',
  'MANAGE_HIERARCHY',
  'MANAGE_CATEGORIES',
  'MANAGE_SLA',
  'VIEW_ANALYTICS',
  'MANAGE_ORGANIZATION',
];

// Convenience default permission bundles used only by the SEED script
// (organizations can freely reconfigure these afterwards — nothing here
// is enforced or referenced by core business logic).
const DEFAULT_BUNDLES = {
  END_USER: ['CREATE_COMPLAINT', 'VIEW_OWN_COMPLAINT'],
  AUTHORITY: [
    'VIEW_ASSIGNED_COMPLAINT',
    'ACKNOWLEDGE_COMPLAINT',
    'START_COMPLAINT',
    'ADD_REMARK',
    'RESOLVE_COMPLAINT',
    'MANUAL_ESCALATE',
  ],
  ORG_ADMIN: PERMISSIONS.filter((p) => p !== 'MANAGE_ORGANIZATION').concat(['MANAGE_ORGANIZATION']),
};

module.exports = { PERMISSIONS, DEFAULT_BUNDLES };
