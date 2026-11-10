const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/organizationalUnitController');
const { authenticate } = require('../middleware/auth');
const { requirePermission, requireOrganizationContext } = require('../middleware/permission');

router.use(authenticate, requireOrganizationContext);

router.get('/', ctrl.list);
router.post('/', requirePermission('MANAGE_ORGANIZATION'), ctrl.create);
router.patch('/:id', requirePermission('MANAGE_ORGANIZATION'), ctrl.update);
router.delete('/:id', requirePermission('MANAGE_ORGANIZATION'), ctrl.remove);

module.exports = router;
