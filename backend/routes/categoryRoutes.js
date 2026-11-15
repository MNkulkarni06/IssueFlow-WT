const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/categoryController');
const { authenticate } = require('../middleware/auth');
const { requirePermission, requireOrganizationContext } = require('../middleware/permission');

router.use(authenticate, requireOrganizationContext);

router.get('/', ctrl.list);
router.post('/', requirePermission('MANAGE_CATEGORIES'), ctrl.create);
router.patch('/:id', requirePermission('MANAGE_CATEGORIES'), ctrl.update);
router.delete('/:id', requirePermission('MANAGE_CATEGORIES'), ctrl.remove);

module.exports = router;
