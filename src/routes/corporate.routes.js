const express = require('express');
const router = express.Router();
const {
    createCorporateAccount,
    getCorporateAccounts,
    getCorporateAccount,
    updateCorporateAccount,
    deleteCorporateAccount,
    getCorporateRate
} = require('../controllers/corporate.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.use(protect);

router
    .route('/')
    .post(authorize('admin'), createCorporateAccount)
    .get(authorize('admin'), getCorporateAccounts);

router
    .route('/:id')
    .get(authorize('admin'), getCorporateAccount)
    .put(authorize('admin'), updateCorporateAccount)
    .delete(authorize('admin'), deleteCorporateAccount);

router.get('/:id/rate/:roomType', getCorporateRate);

module.exports = router;
