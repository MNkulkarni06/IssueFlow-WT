require('dotenv').config();
const connectDB = require('../config/db');
const {
  Organization,
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
const notificationService = require('../services/notificationService');

const DEMO_PASSWORD = 'Demo@123';
const HOUR = 3600000;
const ago = (hours) => new Date(Date.now() - hours * HOUR);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

const AUTHORITY_PERMS = ['VIEW_ASSIGNED_COMPLAINT', 'ACKNOWLEDGE_COMPLAINT', 'START_COMPLAINT', 'ADD_REMARK', 'RESOLVE_COMPLAINT', 'MANUAL_ESCALATE'];
const END_USER_PERMS = ['CREATE_COMPLAINT', 'VIEW_OWN_COMPLAINT', 'CANCEL_COMPLAINT'];

async function wipe() {
  await Promise.all([
    Organization.deleteMany({}),
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
  const { OrganizationalUnit } = require('../models');
  await OrganizationalUnit.deleteMany({});
  console.log('[seed] Cleared existing data.');
}

async function createSystemAdmin() {
  return User.create({
    organizationId: null,
    name: 'IssueFlow Platform Admin',
    email: 'sysadmin@issueflow.demo',
    password: DEMO_PASSWORD,
    systemRole: 'SYSTEM_ADMIN',
    status: 'ACTIVE',
  });
}

// ---------------------------------------------------------------------------
// Organization builder: everything below is pure configuration.
// ---------------------------------------------------------------------------
async function buildOrganization(cfg) {
  const { name, type, emailPrefix } = cfg;
  const org = await Organization.create({
    name,
    type,
    description: `${name} - demo organization (${type})`,
    contactEmail: `contact@${emailPrefix}.demo`,
    status: 'ACTIVE',
    settings: { slaWarningPercent: 80, usesOrganizationalUnits: false, setupComplete: true },
  });

  const depts = {};
  for (const d of cfg.departments) {
    // eslint-disable-next-line no-await-in-loop
    depts[d] = await Department.create({ organizationId: org._id, name: d, description: `${d} department` });
  }
  const primaryDept = depts[cfg.departments[0]];

  const positions = {};
  const mkPosition = async (posName, description, permissions, extra = {}) => {
    positions[posName] = await Position.create({ organizationId: org._id, name: posName, description, permissions, ...extra });
    return positions[posName];
  };

  const adminPos = await mkPosition('Organization Admin', 'Full administrative control over this organization.', PERMISSIONS, { isOrgAdmin: true });
  const endUserPos = await mkPosition(cfg.endUserLabel, `${cfg.endUserLabel} - submits complaints.`, END_USER_PERMS, { isEndUserRole: true, departmentId: primaryDept._id });
  for (const label of cfg.hierarchyLabels) {
    // eslint-disable-next-line no-await-in-loop
    await mkPosition(label, `${label} - handles assigned complaints and can escalate.`, AUTHORITY_PERMS, { departmentId: primaryDept._id });
  }

  // Default (organization-wide) escalation chain.
  for (let i = 0; i < cfg.hierarchyLabels.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await HierarchyLevel.create({
      organizationId: org._id,
      scopeDepartmentId: null,
      order: i + 1,
      label: `Level ${i + 1}: ${cfg.hierarchyLabels[i]}`,
      positionId: positions[cfg.hierarchyLabels[i]]._id,
      slaHours: null,
    });
  }

  // Department-specific chains (their own positions/users, plus reused ones).
  const chainUsers = {};
  for (const chain of cfg.chains || []) {
    const dept = depts[chain.department];
    for (let i = 0; i < chain.levels.length; i += 1) {
      const lvl = chain.levels[i];
      let pos = lvl.reuse ? positions[lvl.reuse] : null;
      if (!pos) {
        // eslint-disable-next-line no-await-in-loop
        pos = await mkPosition(lvl.label, `${lvl.label} - ${chain.department} chain.`, AUTHORITY_PERMS, { departmentId: dept._id });
        // eslint-disable-next-line no-await-in-loop
        chainUsers[lvl.label] = await User.create({
          organizationId: org._id,
          name: lvl.person,
          email: `${emailPrefix}.${slug(lvl.label)}@issueflow.demo`,
          password: DEMO_PASSWORD,
          roleId: pos._id,
          departmentId: dept._id,
          designation: lvl.label,
        });
      }
      // eslint-disable-next-line no-await-in-loop
      await HierarchyLevel.create({
        organizationId: org._id,
        scopeDepartmentId: dept._id,
        order: i + 1,
        label: `Level ${i + 1}: ${pos.name}`,
        positionId: pos._id,
        slaHours: lvl.slaHours || null,
      });
    }
  }

  const cats = {};
  for (const c of cfg.categories) {
    // eslint-disable-next-line no-await-in-loop
    cats[c.name] = await ComplaintCategory.create({
      organizationId: org._id,
      name: c.name,
      description: c.description || '',
      priority: c.priority,
      slaHours: c.slaHours,
      defaultDepartmentId: c.routeTo ? depts[c.routeTo]._id : null,
    });
  }

  const admin = await User.create({
    organizationId: org._id,
    name: cfg.people.admin,
    email: `${emailPrefix}.admin@issueflow.demo`,
    password: DEMO_PASSWORD,
    phone: '+91 98765 43210',
    roleId: adminPos._id,
    departmentId: primaryDept._id,
    designation: 'Organization Administrator',
  });

  const endUsers = [];
  for (let i = 0; i < cfg.people.endUsers.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    endUsers.push(await User.create({
      organizationId: org._id,
      name: cfg.people.endUsers[i],
      email: `${emailPrefix}.${slug(cfg.endUserLabel)}${i === 0 ? '' : i + 1}@issueflow.demo`,
      password: DEMO_PASSWORD,
      roleId: endUserPos._id,
      departmentId: primaryDept._id,
      designation: cfg.endUserLabel,
    }));
  }

  const levelUsers = [];
  for (let i = 0; i < cfg.hierarchyLabels.length; i += 1) {
    const label = cfg.hierarchyLabels[i];
    // eslint-disable-next-line no-await-in-loop
    levelUsers.push(await User.create({
      organizationId: org._id,
      name: cfg.people.levels[i],
      email: `${emailPrefix}.${slug(label)}@issueflow.demo`,
      password: DEMO_PASSWORD,
      roleId: positions[label]._id,
      departmentId: primaryDept._id,
      designation: label,
    }));
  }

  // A few audit-log entries so the configuration history is not empty.
  await AuditLog.insertMany([
    { organizationId: org._id, performedBy: admin._id, action: 'HIERARCHY_CHANGED', targetType: 'HierarchyLevel', details: { note: 'Default escalation chain configured' }, timestamp: ago(24 * 14) },
    ...(cfg.chains || []).map((c) => ({ organizationId: org._id, performedBy: admin._id, action: 'HIERARCHY_CHANGED', targetType: 'HierarchyLevel', details: { note: `${c.department} chain configured` }, timestamp: ago(24 * 10) })),
  ]);

  return { org, depts, primaryDept, positions, cats, admin, endUsers, levelUsers, chainUsers, chains: cfg.chains || [] };
}

// ---------------------------------------------------------------------------
// Scenario runner: drives the REAL services, then rewrites timestamps so the
// complaint looks like it lived for days (nice charts and timelines).
// ---------------------------------------------------------------------------
async function currentActor(ctx, complaintId) {
  const c = await Complaint.findById(complaintId);
  if (c.currentAssignee) {
    const u = await User.findById(c.currentAssignee);
    if (u) return u;
  }
  return ctx.admin;
}

async function history(c, actor, action, previousStatus, newStatus, reason = '') {
  await ComplaintHistory.create({
    complaintId: c._id,
    organizationId: c.organizationId,
    performedBy: actor._id,
    action,
    previousStatus,
    newStatus,
    previousLevel: c.currentHierarchyOrder,
    newLevel: c.currentHierarchyOrder,
    reason,
  });
}

async function applyStep(ctx, complaintId, step, submitter) {
  const c = await Complaint.findById(complaintId);
  const actor = await currentActor(ctx, complaintId);
  switch (step.t) {
    case 'ack':
      await history(c, actor, 'Acknowledged', c.status, c.status);
      await notificationService.notify({ organizationId: c.organizationId, userId: c.submittedBy, type: 'COMPLAINT_ACKNOWLEDGED', title: 'Complaint acknowledged', message: `Your complaint "${c.title}" has been acknowledged.`, complaintId: c._id });
      break;
    case 'start': {
      const prev = c.status;
      complaintService.assertTransition(prev, 'IN_PROGRESS');
      c.status = 'IN_PROGRESS';
      await c.save();
      await history(c, actor, 'Work Started', prev, 'IN_PROGRESS');
      await notificationService.notify({ organizationId: c.organizationId, userId: c.submittedBy, type: 'COMPLAINT_STARTED', title: 'Work started on your complaint', message: `Work has started on your complaint "${c.title}".`, complaintId: c._id });
      break;
    }
    case 'remark':
      await history(c, step.by === 'submitter' ? submitter : actor, 'Remark Added', c.status, c.status, step.text);
      break;
    case 'escalate':
      await Complaint.updateOne({ _id: c._id }, { $set: { slaDeadline: new Date(Date.now() - 60 * 1000) } });
      await escalationService.escalateComplaint(c._id, { performedBy: null, reason: step.reason || 'SLA deadline passed (automatic)' });
      break;
    case 'resolve': {
      const prev = c.status;
      complaintService.assertTransition(prev, 'RESOLVED');
      c.status = 'RESOLVED';
      c.resolvedAt = new Date();
      c.resolutionRemarks = step.text;
      await c.save();
      await history(c, actor, 'Complaint Resolved', prev, 'RESOLVED', step.text);
      await notificationService.notify({ organizationId: c.organizationId, userId: c.submittedBy, type: 'COMPLAINT_RESOLVED', title: 'Your complaint was resolved', message: `Your complaint "${c.title}" has been resolved.`, complaintId: c._id });
      break;
    }
    case 'cancel': {
      const prev = c.status;
      complaintService.assertTransition(prev, 'CANCELLED');
      c.status = 'CANCELLED';
      await c.save();
      await history(c, submitter, 'Complaint Cancelled', prev, 'CANCELLED', 'Cancelled by user.');
      await notificationService.notify({ organizationId: c.organizationId, userId: c.submittedBy, type: 'COMPLAINT_CANCELLED', title: 'Complaint cancelled', message: `Complaint "${c.title}" has been cancelled.`, complaintId: c._id });
      break;
    }
    default:
      throw new Error(`Unknown step ${step.t}`);
  }
}

async function retime(complaintId, createdAt, spanHours) {
  const start = createdAt.getTime();
  const end = Math.min(Date.now() - 5 * 60 * 1000, start + spanHours * HOUR);
  const spread = async (Model, filter) => {
    const docs = await Model.find(filter).sort({ _id: 1 }).select('_id');
    const stamps = [];
    for (let i = 0; i < docs.length; i += 1) {
      const ts = new Date(start + ((end - start) * i) / Math.max(docs.length - 1, 1));
      stamps.push(ts);
      // eslint-disable-next-line no-await-in-loop
      await Model.collection.updateOne({ _id: docs[i]._id }, { $set: Model === ComplaintHistory ? { timestamp: ts } : { createdAt: ts, updatedAt: ts } });
    }
    return stamps;
  };
  const hist = await ComplaintHistory.find({ complaintId }).sort({ _id: 1 });
  const stamps = await spread(ComplaintHistory, { complaintId });
  await spread(Notification, { complaintId });
  let lastEscalatedAt = null;
  hist.forEach((h, i) => { if (/Escalated/.test(h.action)) lastEscalatedAt = stamps[i]; });
  return { lastEscalatedAt, lastStamp: stamps[stamps.length - 1] || new Date(end) };
}

async function runScenario(ctx, spec) {
  const submitter = ctx.endUsers[spec.user];
  const category = ctx.cats[spec.cat];
  const c = await complaintService.createComplaint({
    user: submitter,
    title: spec.title,
    description: spec.desc,
    categoryId: category._id,
    departmentId: ctx.primaryDept._id,
    priority: spec.priority,
  });
  for (const step of spec.steps || []) {
    // eslint-disable-next-line no-await-in-loop
    await applyStep(ctx, c._id, step, submitter);
  }

  const createdAt = ago(spec.age);
  const { lastEscalatedAt, lastStamp } = await retime(c._id, createdAt, spec.span != null ? spec.span : spec.age);
  const fresh = await Complaint.findById(c._id);
  const terminal = ['RESOLVED', 'CANCELLED'].includes(fresh.status);
  const dueIn = spec.dueIn != null ? spec.dueIn : category.slaHours * 0.5;
  const set = {
    createdAt,
    updatedAt: lastStamp,
    slaWarningSent: spec.warn ? false : true,
    slaDeadline: terminal ? new Date(createdAt.getTime() + category.slaHours * HOUR) : new Date(Date.now() + dueIn * HOUR),
  };
  if (lastEscalatedAt) set.lastEscalatedAt = lastEscalatedAt;
  if (fresh.status === 'RESOLVED') set.resolvedAt = lastStamp;
  await Complaint.collection.updateOne({ _id: c._id }, { $set: set });
  return c;
}

// Builds the same 14 lifecycle situations for every organization.
function scenarios(t) {
  return [
    // --- freshly submitted ---
    { user: 1, cat: t.fresh1[0], title: t.fresh1[1], desc: t.fresh1[2], age: 1, steps: [] },
    { user: 2, cat: t.fresh2[0], title: t.fresh2[1], desc: t.fresh2[2], age: 3, steps: [] },
    // --- acknowledged (still OPEN) ---
    { user: 0, cat: t.ack[0], title: t.ack[1], desc: t.ack[2], age: 6, span: 4, steps: [{ t: 'ack' }] },
    // --- in progress with a conversation ---
    { user: 0, cat: t.prog[0], title: t.prog[1], desc: t.prog[2], age: 20, span: 12,
      steps: [{ t: 'ack' }, { t: 'start' }, { t: 'remark', text: t.prog[3] }, { t: 'remark', by: 'submitter', text: 'Thank you, I will wait for the update.' }] },
    // --- escalated once, then picked up by the next authority ---
    { user: 1, cat: t.esc1[0], title: t.esc1[1], desc: t.esc1[2], age: 50, span: 40, priority: 'HIGH',
      steps: [{ t: 'escalate', reason: 'SLA deadline passed (automatic)' }, { t: 'ack' }, { t: 'start' }, { t: 'remark', text: t.esc1[3] }] },
    // --- escalated twice (now at Level 3) ---
    { user: 2, cat: t.esc2[0], title: t.esc2[1], desc: t.esc2[2], age: 100, span: 90, priority: 'HIGH',
      steps: [{ t: 'escalate' }, { t: 'escalate' }, { t: 'remark', text: t.esc2[3] }] },
    // --- reached the top of the chain: needs admin intervention ---
    { user: 0, cat: t.max[0], title: t.max[1], desc: t.max[2], age: 200, span: 190, priority: 'CRITICAL', dueIn: -5,
      steps: [{ t: 'escalate' }, { t: 'escalate' }, { t: 'escalate' }, { t: 'escalate' }] },
    // --- resolved (different speeds -> average resolution time) ---
    { user: 1, cat: t.res1[0], title: t.res1[1], desc: t.res1[2], age: 120, span: 6,
      steps: [{ t: 'ack' }, { t: 'start' }, { t: 'resolve', text: t.res1[3] }] },
    { user: 2, cat: t.res2[0], title: t.res2[1], desc: t.res2[2], age: 72, span: 30,
      steps: [{ t: 'ack' }, { t: 'start' }, { t: 'resolve', text: t.res2[3] }] },
    { user: 0, cat: t.res3[0], title: t.res3[1], desc: t.res3[2], age: 190, span: 60, priority: 'MEDIUM',
      steps: [{ t: 'escalate' }, { t: 'ack' }, { t: 'start' }, { t: 'resolve', text: t.res3[3] }] },
    // --- cancelled by the person who filed it ---
    { user: 1, cat: t.cancel[0], title: t.cancel[1], desc: t.cancel[2], age: 40, span: 3, steps: [{ t: 'cancel' }] },
    // --- about to breach: the SLA warning job will notify the assignee ---
    { user: 2, cat: t.warn[0], title: t.warn[1], desc: t.warn[2], age: t.warn[3], dueIn: t.warn[4], warn: true, steps: [{ t: 'ack' }] },
    // --- routed by CATEGORY to a department with its own chain ---
    { user: 0, cat: t.routed[0], title: t.routed[1], desc: t.routed[2], age: 2, steps: [] },
    { user: 1, cat: t.routedEsc[0], title: t.routedEsc[1], desc: t.routedEsc[2], age: 30, span: 20, priority: 'CRITICAL',
      steps: [{ t: 'escalate' }, { t: 'ack' }, { t: 'start' }, { t: 'remark', text: t.routedEsc[3] }] },
  ];
}

async function finishOrg(ctx) {
  // Realistic inbox: older notifications read, recent ones unread.
  await Notification.collection.updateMany({ organizationId: ctx.org._id, createdAt: { $lt: ago(48) } }, { $set: { read: true } });
  // Make sure the org admin has something waiting for them.
  await Notification.collection.updateMany({ userId: ctx.admin._id }, { $set: { read: false, createdAt: ago(2), updatedAt: ago(2) } });
}

async function seedOrg(cfg) {
  const ctx = await buildOrganization(cfg);
  for (const spec of scenarios(cfg.text)) {
    // eslint-disable-next-line no-await-in-loop
    await runScenario(ctx, spec);
  }
  await finishOrg(ctx);

  const total = await Complaint.countDocuments({ organizationId: ctx.org._id });
  console.log(`\n[seed] ${cfg.name} (${cfg.type}) - ${total} complaints`);
  console.log(`[seed]   Admin        : ${ctx.admin.email}  (${ctx.admin.name})`);
  ctx.endUsers.forEach((u) => console.log(`[seed]   ${cfg.endUserLabel.padEnd(12)}: ${u.email}  (${u.name})`));
  ctx.levelUsers.forEach((u, i) => console.log(`[seed]   Level ${i + 1} ${u.designation.padEnd(18)}: ${u.email}  (${u.name})`));
  Object.values(ctx.chainUsers).forEach((u) => console.log(`[seed]   Dept chain ${u.designation.padEnd(16)}: ${u.email}  (${u.name})`));
  return ctx;
}

// ---------------------------------------------------------------------------
async function run() {
  await connectDB();
  await wipe();
  const sys = await createSystemAdmin();
  console.log(`[seed] System admin: ${sys.email}`);

  await seedOrg({
    name: 'ABC Bank', type: 'BANK', emailPrefix: 'bank',
    departments: ['Customer Service', 'Loans', 'IT', 'Security'],
    hierarchyLabels: ['Branch Officer', 'Branch Manager', 'Regional Manager', 'Zonal Manager'],
    endUserLabel: 'Customer',
    people: { admin: 'Rohan Deshmukh', endUsers: ['Aarav Sharma', 'Priya Nair', 'Imran Sheikh'], levels: ['Sneha Patil', 'Vikram Joshi', 'Anita Rao', 'Suresh Menon'] },
    chains: [{ department: 'Loans', levels: [
      { label: 'Loan Officer', person: 'Kiran Bhosale' },
      { label: 'Loan Manager', person: 'Neha Kapoor', slaHours: 12 },
      { reuse: 'Regional Manager' },
      { reuse: 'Zonal Manager' },
    ] }],
    categories: [
      { name: 'ATM Issue', priority: 'HIGH', slaHours: 4, description: 'Cash, card or ATM machine problems' },
      { name: 'Transaction Issue', priority: 'HIGH', slaHours: 8, description: 'UPI, NEFT and card payment failures' },
      { name: 'Account Issue', priority: 'MEDIUM', slaHours: 24, description: 'KYC, statements and account services' },
      { name: 'Fraud/Security', priority: 'CRITICAL', slaHours: 2, description: 'Suspicious activity and fraud reports' },
      { name: 'Loan Issue', priority: 'HIGH', slaHours: 24, routeTo: 'Loans', description: 'Routed to the Loans department chain' },
    ],
    text: {
      fresh1: ['Fraud/Security', 'Unrecognised debit of Rs 4,999 on my account', 'A debit I did not make appeared this morning. Please investigate.'],
      fresh2: ['Account Issue', 'KYC update pending for two weeks', 'I submitted my KYC documents but the status has not changed.'],
      ack: ['Transaction Issue', 'UPI payment debited but not received by merchant', 'Money left my account but the merchant says it has not arrived.'],
      prog: ['ATM Issue', 'ATM at Camp branch not dispensing cash', 'The machine shows success but no cash comes out.', 'Technician has been called; the ATM is being serviced today.'],
      esc1: ['Transaction Issue', 'NEFT transfer stuck for 3 days', 'The transfer shows pending and the beneficiary has not received it.', 'Escalated case: contacted the settlement team for a manual release.'],
      esc2: ['Account Issue', 'Wrong charges on savings account', 'Annual maintenance charge deducted twice.', 'Regional team is reviewing the charge reversal request.'],
      max: ['Fraud/Security', 'Suspicious login alerts not investigated', 'Several login alerts from unknown devices were reported earlier with no response.'],
      res1: ['ATM Issue', 'Card stuck in ATM machine', 'The ATM kept my debit card after a failed attempt.', 'Card retrieved and returned to the customer at the branch.'],
      res2: ['Account Issue', 'Passbook not updated', 'Last three months of entries are missing from the passbook.', 'Passbook updated at the branch counter.'],
      res3: ['Transaction Issue', 'Double debit on bill payment', 'Electricity bill payment was debited twice.', 'Duplicate debit reversed to the customer account.'],
      cancel: ['Account Issue', 'Request to change registered mobile number', 'Raised twice by mistake; closing this duplicate.'],
      warn: ['ATM Issue', 'ATM receipt printer not working', 'The receipt printer at the main branch ATM is jammed.', 3.4, 0.6],
      routed: ['Loan Issue', 'Home loan EMI calculation mismatch', 'The EMI deducted is higher than the amount in my sanction letter.'],
      routedEsc: ['Loan Issue', 'Loan foreclosure statement delayed', 'I requested a foreclosure statement two days ago and have received nothing.', 'Loan Manager has requested the statement from the core banking team.'],
    },
  });

  await seedOrg({
    name: 'Green Valley School', type: 'SCHOOL', emailPrefix: 'school',
    departments: ['Academics', 'Transport', 'Administration'],
    hierarchyLabels: ['Teacher', 'Department Head', 'Principal', 'Management'],
    endUserLabel: 'Student',
    people: { admin: 'Dr. Meera Kulkarni', endUsers: ['Aditya Kulkarni', 'Riya Deshpande', 'Kabir Shaikh'], levels: ['Mrs. Sunita Pawar', 'Mr. Rahul Gokhale', 'Dr. Alka Joshi', 'Mr. Prakash Naik'] },
    chains: [{ department: 'Transport', levels: [
      { label: 'Transport Officer', person: 'Mr. Dinesh More' },
      { label: 'Transport Head', person: 'Mr. Ajay Bhide', slaHours: 6 },
      { reuse: 'Principal' },
      { reuse: 'Management' },
    ] }],
    categories: [
      { name: 'Infrastructure', priority: 'MEDIUM', slaHours: 24, description: 'Classrooms, furniture and facilities' },
      { name: 'Academic', priority: 'MEDIUM', slaHours: 48, description: 'Marks, timetable and exams' },
      { name: 'Transport', priority: 'HIGH', slaHours: 12, routeTo: 'Transport', description: 'School bus: routed to the Transport chain, not the Teacher' },
      { name: 'Security', priority: 'CRITICAL', slaHours: 4, description: 'Safety and campus security' },
      { name: 'Fees', priority: 'LOW', slaHours: 72, description: 'Fee receipts and scholarships' },
    ],
    text: {
      fresh1: ['Infrastructure', 'Classroom 7 projector not working', 'The projector shows no signal during lessons.'],
      fresh2: ['Fees', 'Fee receipt shows wrong amount', 'The receipt amount does not match what was paid.'],
      ack: ['Academic', 'Timetable clash between Physics lab and Maths', 'Both are scheduled in the same slot on Thursday.'],
      prog: ['Infrastructure', 'Broken benches in Class 8B', 'Three benches are broken and unsafe to use.', 'Carpenter has been scheduled for tomorrow morning.'],
      esc1: ['Academic', 'Unit test marks not updated on portal', 'Marks for the unit test are still missing on the portal.', 'Department Head is verifying marks with the subject teacher.'],
      esc2: ['Security', 'Unknown visitors entering near the back gate', 'Visitors are entering without signing the register.', 'Principal has requested a guard to be posted at the back gate.'],
      max: ['Infrastructure', 'Leaking roof in the library not repaired', 'Water leaks onto the book shelves during every rain.'],
      res1: ['Academic', 'Wrong subject printed on hall ticket', 'Hall ticket lists Biology instead of Computer Science.', 'Hall ticket reissued with the correct subject.'],
      res2: ['Fees', 'Scholarship amount not adjusted', 'The scholarship was not deducted from the term fee.', 'Fee ledger corrected and difference refunded.'],
      res3: ['Infrastructure', 'Water cooler on 2nd floor out of order', 'The water cooler has been dry for a week.', 'Cooler repaired and tested.'],
      cancel: ['Fees', 'Late fee waiver request', 'Raised by mistake; the waiver was already granted.'],
      warn: ['Security', 'Broken lock on sports room', 'The lock on the sports room door is broken.', 3.4, 0.6],
      routed: ['Transport', 'School bus 12 arrives 30 minutes late every day', 'Bus 12 on the Kothrud route has been late all week.'],
      routedEsc: ['Transport', 'Bus driver using phone while driving', 'The driver of bus 7 was seen using a phone on the highway.', 'Transport Head has issued a warning and scheduled a safety briefing.'],
    },
  });

  await seedOrg({
    name: 'TechNova Solutions', type: 'COMPANY', emailPrefix: 'company',
    departments: ['Engineering', 'HR', 'IT', 'Finance'],
    hierarchyLabels: ['Team Lead', 'Engineering Manager', 'HR Manager', 'Director'],
    endUserLabel: 'Employee',
    people: { admin: 'Nikhil Rane', endUsers: ['Shruti Iyer', 'Rahul Verma', 'Pooja Mehta'], levels: ['Ankit Saxena', 'Divya Reddy', 'Karan Malhotra', 'Sanjay Gupta'] },
    chains: [{ department: 'IT', levels: [
      { label: 'IT Support Engineer', person: 'Farhan Qureshi' },
      { label: 'IT Manager', person: 'Lakshmi Narayan', slaHours: 1 },
      { reuse: 'Director' },
    ] }],
    categories: [
      { name: 'IT Issue', priority: 'HIGH', slaHours: 2, routeTo: 'IT', description: 'Laptops, VPN, email: routed to the IT chain' },
      { name: 'HR Issue', priority: 'MEDIUM', slaHours: 24, description: 'Leave, policies and reimbursements' },
      { name: 'Payroll', priority: 'HIGH', slaHours: 24, description: 'Salary slips, tax and deductions' },
      { name: 'Infrastructure', priority: 'MEDIUM', slaHours: 48, description: 'Office facilities' },
      { name: 'Security', priority: 'CRITICAL', slaHours: 2, description: 'Physical and information security' },
    ],
    text: {
      fresh1: ['Payroll', 'Salary slip missing for October', 'The October salary slip is not visible in the portal.'],
      fresh2: ['HR Issue', 'Leave balance not reflected', 'Approved leave has not been deducted from my balance.'],
      ack: ['Infrastructure', 'AC not working in conference room 3', 'The room is too hot to hold meetings.'],
      prog: ['HR Issue', 'Reimbursement claim pending for 3 weeks', 'Travel reimbursement was submitted on the 12th.', 'Finance has approved; payment will be in the next payroll run.'],
      esc1: ['Payroll', 'Incorrect tax deduction in payroll', 'TDS deducted is higher than the declared amount.', 'HR Manager is reviewing the investment declaration with Finance.'],
      esc2: ['Infrastructure', 'Broken chairs in the engineering bay', 'Several chairs are damaged and unsafe.', 'Replacement order raised with the vendor.'],
      max: ['Security', 'Tailgating at the main entrance not addressed', 'People follow employees through the turnstile without badges.'],
      res1: ['Payroll', 'Bonus credited to the wrong bank account', 'The bonus went to a closed account.', 'Amount recovered and credited to the correct account.'],
      res2: ['HR Issue', 'Emergency contact details need updating', 'My emergency contact is outdated in the HR system.', 'Contact details updated.'],
      res3: ['Infrastructure', 'Water leakage near the pantry', 'There is a puddle near the pantry every morning.', 'Pipe replaced and floor dried.'],
      cancel: ['HR Issue', 'Work-from-home policy question', 'Answered elsewhere; withdrawing this request.'],
      warn: ['Security', 'Visitor badge printer offline', 'The reception badge printer is not responding.', 1.7, 0.3],
      routed: ['IT Issue', 'VPN keeps disconnecting every 10 minutes', 'I cannot work remotely because the VPN keeps dropping.'],
      routedEsc: ['IT Issue', 'Laptop not booting before client demo', 'The laptop fails to boot and the demo is this afternoon.', 'IT Manager is arranging a replacement laptop.'],
    },
  });

  console.log('\n[seed] Done. Password for ALL accounts:', DEMO_PASSWORD);
  console.log('[seed] System admin: sysadmin@issueflow.demo');
  process.exit(0);
}

run().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
