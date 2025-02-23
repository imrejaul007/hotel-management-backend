const Hotel = require('../models/hotel.model');

exports.createHotel = async (hotelData) => {
    const hotel = await Hotel.create(hotelData);
    return hotel;
};

exports.getAllHotels = async (query = {}) => {
    const hotels = await Hotel.find(query);
    return hotels;
};

exports.getHotelById = async (id) => {
    const hotel = await Hotel.findById(id);
    if (!hotel) {
        throw new Error('Hotel not found');
    }
    return hotel;
};

exports.updateHotel = async (id, updateData) => {
    const hotel = await Hotel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
    );
    if (!hotel) {
        throw new Error('Hotel not found');
    }
    return hotel;
};

exports.deleteHotel = async (id) => {
    const hotel = await Hotel.findByIdAndDelete(id);
    if (!hotel) {
        throw new Error('Hotel not found');
    }
    return hotel;
};

// Room management
exports.addRoom = async (hotelId, roomData) => {
    const hotel = await Hotel.findById(hotelId);
    if (!hotel) {
        throw new Error('Hotel not found');
    }
    hotel.rooms.push(roomData);
    await hotel.save();
    return hotel;
};

exports.updateRoom = async (hotelId, roomId, roomData) => {
    const hotel = await Hotel.findOneAndUpdate(
        { '_id': hotelId, 'rooms._id': roomId },
        { $set: { 'rooms.$': roomData } },
        { new: true }
    );
    if (!hotel) {
        throw new Error('Hotel or room not found');
    }
    return hotel;
};

exports.deleteRoom = async (hotelId, roomId) => {
    const hotel = await Hotel.findByIdAndUpdate(
        hotelId,
        { $pull: { rooms: { _id: roomId } } },
        { new: true }
    );
    if (!hotel) {
        throw new Error('Hotel not found');
    }
    return hotel;
};
