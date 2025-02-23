const hotelService = require('../services/hotel.service');
const { successResponse, errorResponse } = require('../utils/response.util');

exports.createHotel = async (req, res) => {
    try {
        const hotel = await hotelService.createHotel(req.body);
        return successResponse(res, 201, 'Hotel created successfully', hotel);
    } catch (error) {
        return errorResponse(res, 400, error.message);
    }
};

exports.getAllHotels = async (req, res) => {
    try {
        const hotels = await hotelService.getAllHotels(req.query);
        return successResponse(res, 200, 'Hotels retrieved successfully', hotels);
    } catch (error) {
        return errorResponse(res, 500, error.message);
    }
};

exports.getHotelById = async (req, res) => {
    try {
        const hotel = await hotelService.getHotelById(req.params.id);
        return successResponse(res, 200, 'Hotel retrieved successfully', hotel);
    } catch (error) {
        return errorResponse(res, 404, error.message);
    }
};

exports.updateHotel = async (req, res) => {
    try {
        const hotel = await hotelService.updateHotel(req.params.id, req.body);
        return successResponse(res, 200, 'Hotel updated successfully', hotel);
    } catch (error) {
        return errorResponse(res, 404, error.message);
    }
};

exports.deleteHotel = async (req, res) => {
    try {
        await hotelService.deleteHotel(req.params.id);
        return successResponse(res, 200, 'Hotel deleted successfully');
    } catch (error) {
        return errorResponse(res, 404, error.message);
    }
};

// Room management
exports.addRoom = async (req, res) => {
    try {
        const hotel = await hotelService.addRoom(req.params.hotelId, req.body);
        return successResponse(res, 201, 'Room added successfully', hotel);
    } catch (error) {
        return errorResponse(res, 404, error.message);
    }
};

exports.updateRoom = async (req, res) => {
    try {
        const hotel = await hotelService.updateRoom(
            req.params.hotelId,
            req.params.roomId,
            req.body
        );
        return successResponse(res, 200, 'Room updated successfully', hotel);
    } catch (error) {
        return errorResponse(res, 404, error.message);
    }
};

exports.deleteRoom = async (req, res) => {
    try {
        const hotel = await hotelService.deleteRoom(
            req.params.hotelId,
            req.params.roomId
        );
        return successResponse(res, 200, 'Room deleted successfully', hotel);
    } catch (error) {
        return errorResponse(res, 404, error.message);
    }
};
