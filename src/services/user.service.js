const User = require('../models/user.model');

exports.getAllUsers = async () => {
    return await User.find().select('-password');
};

exports.getUserById = async (userId) => {
    const user = await User.findById(userId).select('-password');
    if (!user) {
        throw new Error('User not found');
    }
    return user;
};

exports.updateUser = async (userId, updateData) => {
    const user = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
        throw new Error('User not found');
    }
    return user;
};

exports.getCurrentUser = async (userId) => {
    const user = await User.findById(userId)
        .select('-password')
        .select('-__v');
    
    if (!user) {
        throw new Error('User not found');
    }
    return user;
};

exports.approveAdmin = async (userId) => {
    // Find and update the user to be admin
    const user = await User.findById(userId);
    if (!user) {
        throw new Error('User not found');
    }

    if (user.role === 'admin') {
        throw new Error('User is already an admin');
    }

    user.role = 'admin';
    await user.save();

    return user;
};
