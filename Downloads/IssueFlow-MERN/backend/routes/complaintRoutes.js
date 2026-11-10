const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/complaintController');
const { authenticate } = require('../middleware/auth');
const { requirePermission, requireOrganizationContext } = require('../middleware/permission');
const { upload } = require('../middleware/upload');

router.use(authenticate, requireOrganizationContext);

router.post('/', requirePermission('CREATE_COMPLAINT'), upload.array('attachments', 5), ctrl.create);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.get('/:id/history', ctrl.getHistory);
router.patch('/:id/acknowledge', requirePermission('ACKNOWLEDGE_COMPLAINT'), ctrl.acknowledge);
router.patch('/:id/start', requirePermission('START_COMPLAINT'), ctrl.start);
router.patch('/:id/resolve', requirePermission('RESOLVE_COMPLAINT'), ctrl.resolve);
router.patch('/:id/cancel', ctrl.cancel);
router.post('/:id/remarks', ctrl.addRemark);
router.post('/:id/escalate', ctrl.manualEscalate);
router.post('/:id/dev-set-deadline', ctrl.devSetDeadline);

module.exports = router;
