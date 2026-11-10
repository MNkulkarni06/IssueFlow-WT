const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/hierarchyController');
const { authenticate } = require('../middleware/auth');
const { requirePermission, requireOrganizationContext } = require('../middleware/permission');

router.use(authenticate, requireOrganizationContext);

router.get('/all', ctrl.listAll);
router.get('/', ctrl.list);
router.post('/', requirePermission('MANAGE_HIERARCHY'), ctrl.create);
router.patch('/reorder', requirePermission('MANAGE_HIERARCHY'), ctrl.reorder);
router.patch('/:id', requirePermission('MANAGE_HIERARCHY'), ctrl.update);
router.delete('/:id', requirePermission('MANAGE_HIERARCHY'), ctrl.remove);

module.exports = router;
