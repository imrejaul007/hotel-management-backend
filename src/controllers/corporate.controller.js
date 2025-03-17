const CorporateAccount = require('../models/CorporateAccount');
const asyncHandler = require('../middleware/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Create corporate account
// @route   POST /api/corporate
// @access  Private/Admin
exports.createCorporateAccount = asyncHandler(async (req, res) => {
    const corporateAccount = await CorporateAccount.create(req.body);
    res.status(201).json({
        success: true,
        data: corporateAccount
    });
});

// @desc    Get all corporate accounts
// @route   GET /api/corporate
// @access  Private/Admin
exports.getCorporateAccounts = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status, search } = req.query;
    const query = {};

    if (status) {
        query.status = status;
    }

    if (search) {
        query.$or = [
            { companyName: { $regex: search, $options: 'i' } },
            { 'contactPerson.email': { $regex: search, $options: 'i' } }
        ];
    }

    const accounts = await CorporateAccount.find(query)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

    const total = await CorporateAccount.countDocuments(query);

    res.status(200).json({
        success: true,
        data: accounts,
        pagination: {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        }
    });
});

// @desc    Get single corporate account
// @route   GET /api/corporate/:id
// @access  Private/Admin
exports.getCorporateAccount = asyncHandler(async (req, res) => {
    const account = await CorporateAccount.findById(req.params.id);
    if (!account) {
        throw new ErrorResponse('Corporate account not found', 404);
    }
    res.status(200).json({
        success: true,
        data: account
    });
});

// @desc    Update corporate account
// @route   PUT /api/corporate/:id
// @access  Private/Admin
exports.updateCorporateAccount = asyncHandler(async (req, res) => {
    let account = await CorporateAccount.findById(req.params.id);
    if (!account) {
        throw new ErrorResponse('Corporate account not found', 404);
    }

    account = await CorporateAccount.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
            new: true,
            runValidators: true
        }
    );

    res.status(200).json({
        success: true,
        data: account
    });
});

// @desc    Delete corporate account
// @route   DELETE /api/corporate/:id
// @access  Private/Admin
exports.deleteCorporateAccount = asyncHandler(async (req, res) => {
    const account = await CorporateAccount.findById(req.params.id);
    if (!account) {
        throw new ErrorResponse('Corporate account not found', 404);
    }

    await account.remove();

    res.status(200).json({
        success: true,
        data: {}
    });
});

// @desc    Get corporate account rate for room
// @route   GET /api/corporate/:id/rate/:roomType
// @access  Private
exports.getCorporateRate = asyncHandler(async (req, res) => {
    const { id, roomType } = req.params;
    const { date } = req.query;

    const account = await CorporateAccount.findById(id);
    if (!account) {
        throw new ErrorResponse('Corporate account not found', 404);
    }

    const baseRate = 100; // This should come from your room rates
    const corporateRate = account.calculateRate(roomType, baseRate, new Date(date));

    res.status(200).json({
        success: true,
        data: {
            baseRate,
            corporateRate,
            discount: ((baseRate - corporateRate) / baseRate * 100).toFixed(2)
        }
    });
});
