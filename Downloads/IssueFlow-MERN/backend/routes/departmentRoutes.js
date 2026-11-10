const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/departmentController');
const { authenticate } = require('../middleware/auth');
const { requirePermission, requireOrganizationContext } = require('../middleware/permission');

router.use(authenticate, requireOrganizationContext);

router.get('/', ctrl.list);
router.post('/', requirePermission('MANAGE_DEPARTMENTS'), ctrl.create);
router.patch('/:id', requirePermission('MANAGE_DEPARTMENTS'), ctrl.update);
router.delete('/:id', requirePermission('MANAGE_DEPARTMENTS'), ctrl.remove);

module.exports = router;
