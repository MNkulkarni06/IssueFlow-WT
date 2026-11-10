const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/positionController');
const { authenticate } = require('../middleware/auth');
const { requirePermission, requireOrganizationContext } = require('../middleware/permission');

router.get('/public/end-user-roles', ctrl.listPublicEndUserPositions);

router.use(authenticate, requireOrganizationContext);

router.get('/', ctrl.list);
router.post('/', requirePermission('MANAGE_ROLES'), ctrl.create);
router.patch('/:id', requirePermission('MANAGE_ROLES'), ctrl.update);
router.delete('/:id', requirePermission('MANAGE_ROLES'), ctrl.remove);

module.exports = router;
