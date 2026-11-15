require('dotenv').config();
const connectDB = require('../config/db');
const {
  Organization,
  OrganizationalUnit,
  Department,
  Position,
  HierarchyLevel,
  ComplaintCategory,
  User,
  Complaint,
  ComplaintHistory,
  Notification,
  AuditLog,
} = require('../models');
const { PERMISSIONS } = require('../utils/permissions');
const complaintService = require('../services/complaintService');
const escalationService = require('../services/escalationService');

const DEMO_PASSWORD = 'Demo@123';

const AUTHORITY_PERMS = ['VIEW_ASSIGNED_COMPLAINT', 'ACKNOWLEDGE_COMPLAINT', 'START_COMPLAINT', 'ADD_REMARK', 'RESOLVE_COMPLAINT', 'MANUAL_ESCALATE'];
const END_USER_PERMS = ['CREATE_COMPLAINT', 'VIEW_OWN_COMPLAINT', 'CANCEL_COMPLAINT'];

async function wipe() {
  await Promise.all([
    Organization.deleteMany({}),
    OrganizationalUnit.deleteMany({}),
    Department.deleteMany({}),
    Position.deleteMany({}),
    HierarchyLevel.deleteMany({}),
    ComplaintCategory.deleteMany({}),
    User.deleteMany({}),
    Complaint.deleteMany({}),
    ComplaintHistory.deleteMany({}),
    Notification.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
  console.log('[seed] Cleared existing data.');
}

async function createSystemAdmin() {
  const admin = await User.create({
    organizationId: null,
    name: 'IssueFlow Platform Admin',
    email: 'sysadmin@issueflow.demo',
    password: DEMO_PASSWORD,
    systemRole: 'SYSTEM_ADMIN',
    status: 'ACTIVE',
  });
  console.log(`[seed] System admin: ${admin.email} / ${DEMO_PASSWORD}`);
  return admin;
}

// Builds one demo organization end-to-end: org, departments, positions
// (org admin + end-user + one per hierarchy level), the hierarchy chain,
// categories, and demo users — all purely from configuration.
async function buildOrganization({ name, type, departments, hierarchyLabels, endUserLabel, categories, emailPrefix }) {
  const org = await Organization.create({
    name,
    type,
    description: `${name} — demo organization (${type})`,
    contactEmail: `contact@${emailPrefix}.demo`,
    status: 'ACTIVE',
    settings: { slaWarningPercent: 80, usesOrganizationalUnits: false, setupComplete: true },
  });

  const deptDocs = {};
  for (const deptName of departments) {
    // eslint-disable-next-line no-await-in-loop
    deptDocs[deptName] = await Department.create({ organizationId: org._id, name: deptName, description: `${deptName} department` });
  }
  const primaryDept = deptDocs[departments[0]];

  const orgAdminPosition = await Position.create({
    organizationId: org._id,
    name: 'Organization Admin',
    description: 'Full administrative control over this organization.',
    permissions: PERMISSIONS,
    isOrgAdmin: true,
  });

  const endUserPosition = await Position.create({
    organizationId: org._id,
    name: endUserLabel,
    description: `${endUserLabel} — submits complaints.`,
    permissions: END_USER_PERMS,
    isEndUserRole: true,
    departmentId: primaryDept._id,
  });

  const hierarchyPositions = [];
  for (const label of hierarchyLabels) {
    // eslint-disable-next-line no-await-in-loop
    const pos = await Position.create({
      organizationId: org._id,
      name: label,
      description: `${label} — handles assigned complaints and can escalate.`,
      permissions: AUTHORITY_PERMS,
      departmentId: primaryDept._id,
    });
    hierarchyPositions.push(pos);
  }

  // Configurable escalation hierarchy — org-wide default chain (no
  // department scope), built purely from the positions above.
  for (let i = 0; i < hierarchyPositions.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await HierarchyLevel.create({
      organizationId: org._id,
      scopeDepartmentId: null,
      order: i + 1,
      label: `Level ${i + 1}: ${hierarchyLabels[i]}`,
      positionId: hierarchyPositions[i]._id,
      slaHours: null, // falls back to category SLA
    });
  }

  const categoryDocs = [];
  for (const cat of categories) {
    // eslint-disable-next-line no-await-in-loop
    categoryDocs.push(await ComplaintCategory.create({ organizationId: org._id, ...cat }));
  }

  const admin = await User.create({
    organizationId: org._id,
    name: `${name} Admin`,
    email: `${emailPrefix}.admin@issueflow.demo`,
    password: DEMO_PASSWORD,
    roleId: orgAdminPosition._id,
    departmentId: primaryDept._id,
    designation: 'Organization Administrator',
  });

  const endUser = await User.create({
    organizationId: org._id,
    name: `${name} ${endUserLabel}`,
    email: `${emailPrefix}.${endUserLabel.toLowerCase().replace(/\s+/g, '')}@issueflow.demo`,
    password: DEMO_PASSWORD,
    roleId: endUserPosition._id,
    departmentId: primaryDept._id,
    designation: endUserLabel,
  });

  const hierarchyUsers = [];
  for (let i = 0; i < hierarchyPositions.length; i += 1) {
    const label = hierarchyLabels[i];
    // eslint-disable-next-line no-await-in-loop
    const u = await User.create({
      organizationId: org._id,
      name: `${name} ${label}`,
      email: `${emailPrefix}.${label.toLowerCase().replace(/\s+/g, '')}@issueflow.demo`,
      password: DEMO_PASSWORD,
      roleId: hierarchyPositions[i]._id,
      departmentId: primaryDept._id,
      designation: label,
    });
    hierarchyUsers.push(u);
  }

  console.log(`[seed] Organization "${name}" created with hierarchy: ${hierarchyLabels.join(' -> ')}`);
  console.log(`[seed]   Admin login: ${admin.email} / ${DEMO_PASSWORD}`);
  console.log(`[seed]   End-user login: ${endUser.email} / ${DEMO_PASSWORD}`);
  hierarchyUsers.forEach((u) => console.log(`[seed]   Authority login: ${u.email} / ${DEMO_PASSWORD}`));

  return { org, primaryDept, categoryDocs, admin, endUser, hierarchyUsers };
}

// Creates a handful of demo complaints across different statuses to
// demonstrate the full lifecycle, using the REAL complaint/escalation
// services (not shortcuts), so history + notifications are realistic.
async function seedComplaints({ endUser, categoryDocs, primaryDept, hierarchyUsers }) {
  // 1. OPEN complaint, freshly submitted.
  await complaintService.createComplaint({
    user: endUser,
    title: `${categoryDocs[0].name} — need assistance`,
    description: `Demo OPEN complaint regarding ${categoryDocs[0].name.toLowerCase()}.`,
    categoryId: categoryDocs[0]._id,
    departmentId: primaryDept._id,
    priority: categoryDocs[0].priority,
  });

  // 2. IN_PROGRESS complaint — acknowledged and started by Level 1 authority.
  const c2 = await complaintService.createComplaint({
    user: endUser,
    title: `${categoryDocs[1 % categoryDocs.length].name} — ongoing issue`,
    description: 'Demo IN_PROGRESS complaint, work has started.',
    categoryId: categoryDocs[1 % categoryDocs.length]._id,
    departmentId: primaryDept._id,
  });
  c2.status = 'IN_PROGRESS';
  await c2.save();
  await ComplaintHistory.create({
    complaintId: c2._id,
    organizationId: c2.organizationId,
    performedBy: hierarchyUsers[0]._id,
    action: 'Work Started',
    previousStatus: 'OPEN',
    newStatus: 'IN_PROGRESS',
    previousLevel: c2.currentHierarchyOrder,
    newLevel: c2.currentHierarchyOrder,
  });

  // 3. ESCALATED complaint — simulate an SLA breach and let the real
  // escalation service move it up one level.
  const c3 = await complaintService.createComplaint({
    user: endUser,
    title: `${categoryDocs[0].name} — unresolved, escalated`,
    description: 'Demo ESCALATED complaint — SLA breached once already.',
    categoryId: categoryDocs[0]._id,
    departmentId: primaryDept._id,
  });
  await Complaint.updateOne({ _id: c3._id }, { $set: { slaDeadline: new Date(Date.now() - 60 * 1000) } });
  await escalationService.escalateComplaint(c3._id, { performedBy: null, reason: 'SLA deadline passed (seed demo)' });

  // 4. RESOLVED complaint.
  const c4 = await complaintService.createComplaint({
    user: endUser,
    title: `${categoryDocs[categoryDocs.length - 1].name} — resolved example`,
    description: 'Demo RESOLVED complaint.',
    categoryId: categoryDocs[categoryDocs.length - 1]._id,
    departmentId: primaryDept._id,
  });
  c4.status = 'RESOLVED';
  c4.resolvedAt = new Date();
  c4.resolutionRemarks = 'Issue fixed and confirmed with the complainant.';
  await c4.save();
  await ComplaintHistory.create({
    complaintId: c4._id,
    organizationId: c4.organizationId,
    performedBy: hierarchyUsers[0]._id,
    action: 'Complaint Resolved',
    previousStatus: 'IN_PROGRESS',
    newStatus: 'RESOLVED',
    previousLevel: c4.currentHierarchyOrder,
    newLevel: c4.currentHierarchyOrder,
    reason: 'Issue fixed and confirmed with the complainant.',
  });
}

async function run() {
  await connectDB();
  await wipe();
  await createSystemAdmin();

  const bank = await buildOrganization({
    name: 'ABC Bank',
    type: 'BANK',
    departments: ['Customer Service', 'Loans', 'IT', 'Security'],
    hierarchyLabels: ['Branch Officer', 'Branch Manager', 'Regional Manager', 'Zonal Manager'],
    endUserLabel: 'Customer',
    categories: [
      { name: 'ATM Issue', priority: 'HIGH', slaHours: 4 },
      { name: 'Transaction Issue', priority: 'HIGH', slaHours: 8 },
      { name: 'Account Issue', priority: 'MEDIUM', slaHours: 24 },
      { name: 'Fraud/Security', priority: 'CRITICAL', slaHours: 2 },
    ],
    emailPrefix: 'bank',
  });
  await seedComplaints(bank);

  const school = await buildOrganization({
    name: 'Green Valley School',
    type: 'SCHOOL',
    departments: ['Academics', 'Transport', 'Administration'],
    hierarchyLabels: ['Teacher', 'Department Head', 'Principal', 'Management'],
    endUserLabel: 'Student',
    categories: [
      { name: 'Infrastructure', priority: 'MEDIUM', slaHours: 24 },
      { name: 'Academic', priority: 'MEDIUM', slaHours: 48 },
      { name: 'Transport', priority: 'HIGH', slaHours: 12 },
      { name: 'Security', priority: 'CRITICAL', slaHours: 4 },
      { name: 'Fees', priority: 'LOW', slaHours: 72 },
    ],
    emailPrefix: 'school',
  });
  await seedComplaints(school);

  const company = await buildOrganization({
    name: 'TechNova Solutions',
    type: 'COMPANY',
    departments: ['Engineering', 'HR', 'IT', 'Finance'],
    hierarchyLabels: ['Team Lead', 'Engineering Manager', 'HR Manager', 'Director'],
    endUserLabel: 'Employee',
    categories: [
      { name: 'IT Issue', priority: 'HIGH', slaHours: 2 },
      { name: 'HR Issue', priority: 'MEDIUM', slaHours: 24 },
      { name: 'Payroll', priority: 'HIGH', slaHours: 24 },
      { name: 'Infrastructure', priority: 'MEDIUM', slaHours: 48 },
      { name: 'Security', priority: 'CRITICAL', slaHours: 2 },
    ],
    emailPrefix: 'company',
  });
  await seedComplaints(company);

  console.log('\n[seed] Done. Demo password for ALL accounts:', DEMO_PASSWORD);
  console.log('[seed] This proves multi-organization isolation: try logging in as bank.admin@issueflow.demo');
  console.log('[seed] then school.admin@issueflow.demo — each only ever sees their own organization\'s data.');
  process.exit(0);
}

run().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
