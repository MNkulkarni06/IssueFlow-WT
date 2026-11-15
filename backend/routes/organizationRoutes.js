const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/organizationController');
const { authenticate } = require('../middleware/auth');
const { requireSystemAdmin } = require('../middleware/permission');

router.get('/public/list', ctrl.listPublicOrganizations);

router.use(authenticate);

router.post('/', requireSystemAdmin, ctrl.createOrganization);
router.get('/', requireSystemAdmin, ctrl.listOrganizations);
router.get('/stats/system', requireSystemAdmin, ctrl.systemStats);
router.get('/:id', ctrl.getOrganization);
router.patch('/:id', ctrl.updateOrganization);
router.post('/:id/admin', requireSystemAdmin, ctrl.createOrgAdmin);

module.exports = router;
