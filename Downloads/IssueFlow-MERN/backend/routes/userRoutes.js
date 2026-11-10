const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { requirePermission, requireOrganizationContext } = require('../middleware/permission');

router.use(authenticate, requireOrganizationContext);

router.get('/', requirePermission('MANAGE_USERS'), ctrl.listUsers);
router.get('/:id', requirePermission('MANAGE_USERS'), ctrl.getUser);
router.post('/', requirePermission('MANAGE_USERS'), ctrl.createUser);
router.patch('/:id', requirePermission('MANAGE_USERS'), ctrl.updateUser);
router.patch('/:id/status', requirePermission('MANAGE_USERS'), ctrl.updateStatus);

module.exports = router;
