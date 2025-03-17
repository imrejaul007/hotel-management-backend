const hotelService = require('../services/hotel.service');
const { successResponse, errorResponse } = require('../utils/response.util');
const { validateHotelData, validateRoomData } = require('../utils/validation.util');

exports.createHotel = async (req, res) => {
    try {
        const validationError = validateHotelData(req.body);
        if (validationError) {
            return errorResponse(res, 400, validationError);
        }

        const hotel = await hotelService.createHotel({
            ...req.body,
            owner: req.user._id
        });
        
        return successResponse(res, 201, 'Hotel created successfully', hotel);
    } catch (error) {
        console.error('Create hotel error:', error);
        return errorResponse(res, 400, error.message);
    }
};

exports.getAllHotels = async (req, res) => {
    try {
        const result = await hotelService.getAllHotels(req.query);
        return successResponse(res, 200, 'Hotels retrieved successfully', result);
    } catch (error) {
        console.error('Get hotels error:', error);
        return errorResponse(res, 500, error.message);
    }
};

exports.getHotelById = async (req, res) => {
    try {
        const result = await hotelService.getHotelById(
            req.params.id,
            req.user ? req.user._id : null
        );
        return successResponse(res, 200, 'Hotel retrieved successfully', result);
    } catch (error) {
        console.error('Get hotel error:', error);
        return errorResponse(res, 404, error.message);
    }
};

exports.updateHotel = async (req, res) => {
    try {
        // Check ownership
        const hotel = await hotelService.getHotelById(req.params.id);
        if (hotel.owner.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            return errorResponse(res, 403, 'Not authorized to update this hotel');
        }

        const validationError = validateHotelData(req.body);
        if (validationError) {
            return errorResponse(res, 400, validationError);
        }

        const updatedHotel = await hotelService.updateHotel(req.params.id, req.body);
        return successResponse(res, 200, 'Hotel updated successfully', updatedHotel);
    } catch (error) {
        console.error('Update hotel error:', error);
        return errorResponse(res, 404, error.message);
    }
};

exports.deleteHotel = async (req, res) => {
    try {
        // Check ownership
        const hotel = await hotelService.getHotelById(req.params.id);
        if (hotel.owner.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            return errorResponse(res, 403, 'Not authorized to delete this hotel');
        }

        await hotelService.deleteHotel(req.params.id);
        return successResponse(res, 200, 'Hotel deleted successfully');
    } catch (error) {
        console.error('Delete hotel error:', error);
        return errorResponse(res, 404, error.message);
    }
};

// Room management
exports.addRoom = async (req, res) => {
    try {
        // Check hotel ownership
        const hotel = await hotelService.getHotelById(req.params.hotelId);
        if (hotel.owner.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            return errorResponse(res, 403, 'Not authorized to add rooms to this hotel');
        }

        const validationError = validateRoomData(req.body);
        if (validationError) {
            return errorResponse(res, 400, validationError);
        }

        const updatedHotel = await hotelService.addRoom(req.params.hotelId, req.body);
        return successResponse(res, 201, 'Room added successfully', updatedHotel);
    } catch (error) {
        console.error('Add room error:', error);
        return errorResponse(res, 404, error.message);
    }
};

exports.updateRoom = async (req, res) => {
    try {
        // Check hotel ownership
        const hotel = await hotelService.getHotelById(req.params.hotelId);
        if (hotel.owner.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            return errorResponse(res, 403, 'Not authorized to update rooms in this hotel');
        }

        const validationError = validateRoomData(req.body);
        if (validationError) {
            return errorResponse(res, 400, validationError);
        }

        const updatedHotel = await hotelService.updateRoom(
            req.params.hotelId,
            req.params.roomId,
            req.body
        );
        return successResponse(res, 200, 'Room updated successfully', updatedHotel);
    } catch (error) {
        console.error('Update room error:', error);
        return errorResponse(res, 404, error.message);
    }
};

exports.deleteRoom = async (req, res) => {
    try {
        // Check hotel ownership
        const hotel = await hotelService.getHotelById(req.params.hotelId);
        if (hotel.owner.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            return errorResponse(res, 403, 'Not authorized to delete rooms from this hotel');
        }

        const updatedHotel = await hotelService.deleteRoom(
            req.params.hotelId,
            req.params.roomId
        );
        return successResponse(res, 200, 'Room deleted successfully', updatedHotel);
    } catch (error) {
        console.error('Delete room error:', error);
        return errorResponse(res, 404, error.message);
    }
};
