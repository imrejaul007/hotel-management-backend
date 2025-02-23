const userService = require('../services/user.service');
const { successResponse, errorResponse } = require('../utils/response.util');

exports.getAllUsers = async (req, res) => {
    try {
        const users = await userService.getAllUsers();
        return successResponse(res, 200, 'Users retrieved successfully', users);
    } catch (error) {
        return errorResponse(res, 500, error.message);
    }
};

exports.getUserById = async (req, res) => {
    try {
        const user = await userService.getUserById(req.params.id);
        return successResponse(res, 200, 'User retrieved successfully', user);
    } catch (error) {
        return errorResponse(res, 500, error.message);
    }
};

exports.updateUser = async (req, res) => {
    try {
        const user = await userService.updateUser(req.params.id, req.body);
        return successResponse(res, 200, 'User updated successfully', user);
    } catch (error) {
        return errorResponse(res, 500, error.message);
    }
};

exports.approveAdmin = async (req, res) => {
    try {
        const user = await userService.approveAdmin(req.params.id);
        return successResponse(res, 200, 'User has been approved as admin successfully', user);
    } catch (error) {
        return errorResponse(res, error.message.includes('not found') ? 404 : 400, error.message);
    }
};

exports.getCurrentUser = async (req, res) => {
    try {
        const user = await userService.getCurrentUser(req.user._id);
        return successResponse(res, 200, 'Current user retrieved successfully', user);
    } catch (error) {
        return errorResponse(res, error.message.includes('not found') ? 404 : 500, error.message);
    }
};
