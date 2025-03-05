const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Check if model exists before defining
if (mongoose.models.User) {
    module.exports = mongoose.models.User;
} else {
    const userSchema = new mongoose.Schema({
        name: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true
        },
        password: {
            type: String,
            required: true,
            minlength: 6
        },
        role: {
            type: String,
            enum: ['user', 'admin', 'staff'],
            default: 'user'
        },
        isAdmin: {
            type: Boolean,
            default: false
        },
        isActive: {
            type: Boolean,
            default: true
        },
        phoneNumber: {
            type: String,
            trim: true
        },
        address: {
            street: String,
            city: String,
            state: String,
            country: String,
            zipCode: String
        },
        profileImage: {
            type: String
        },
        tokens: [{
            type: String
        }],
        preferences: {
            language: {
                type: String,
                default: 'en'
            },
            currency: {
                type: String,
                default: 'USD'
            },
            notifications: {
                email: {
                    type: Boolean,
                    default: true
                },
                sms: {
                    type: Boolean,
                    default: false
                }
            }
        },
        lastLogin: {
            type: Date
        }
    }, {
        timestamps: true
    });

    // Hash password before saving
    userSchema.pre('save', async function(next) {
        const user = this;
        if (user.isModified('password')) {
            user.password = await bcrypt.hash(user.password, 8);
        }
        next();
    });

    // Generate auth token
    userSchema.methods.generateAuthToken = async function() {
        const user = this;
        const token = jwt.sign(
            { userId: user._id.toString() },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        user.tokens = user.tokens.concat(token);
        await user.save();
        
        return token;
    };

    // Find user by credentials
    userSchema.statics.findByCredentials = async (email, password) => {
        const user = await User.findOne({ email });
        if (!user) {
            throw new Error('Invalid login credentials');
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            throw new Error('Invalid login credentials');
        }
        
        return user;
    };

    // Remove sensitive data when converting to JSON
    userSchema.methods.toJSON = function() {
        const user = this;
        const userObject = user.toObject();
        
        delete userObject.password;
        delete userObject.tokens;
        
        return userObject;
    };

    const User = mongoose.model('User', userSchema);
    module.exports = User;
}
