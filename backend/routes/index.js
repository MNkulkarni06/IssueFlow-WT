const express = require('express');
const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/organizations', require('./organizationRoutes'));
router.use('/users', require('./userRoutes'));
router.use('/departments', require('./departmentRoutes'));
router.use('/positions', require('./positionRoutes'));
router.use('/hierarchy', require('./hierarchyRoutes'));
router.use('/categories', require('./categoryRoutes'));
router.use('/organizational-units', require('./organizationalUnitRoutes'));
router.use('/complaints', require('./complaintRoutes'));
router.use('/notifications', require('./notificationRoutes'));
router.use('/analytics', require('./analyticsRoutes'));

module.exports = router;
