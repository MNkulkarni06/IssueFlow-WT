const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/auth');
const { requirePermission, requireOrganizationContext } = require('../middleware/permission');

router.use(authenticate, requireOrganizationContext, requirePermission('VIEW_ANALYTICS'));

router.get('/organization', ctrl.organizationOverview);
router.get('/complaints', ctrl.complaintsBreakdown);
router.get('/escalations', ctrl.escalationsBreakdown);

module.exports = router;
