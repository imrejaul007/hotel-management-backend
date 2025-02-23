const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Hotel Booking API Documentation',
            version: '1.0.0',
            description: 'API documentation for Hotel Booking System with OAuth2 Authentication',
            contact: {
                name: 'API Support',
                email: 'support@example.com'
            }
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Development server',
            },
        ],
        components: {
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            description: 'User ID'
                        },
                        name: {
                            type: 'string',
                            description: 'User full name'
                        },
                        email: {
                            type: 'string',
                            format: 'email',
                            description: 'User email address'
                        },
                        role: {
                            type: 'string',
                            enum: ['user', 'admin'],
                            description: 'User role'
                        },
                        googleId: {
                            type: 'string',
                            description: 'Google OAuth2 ID'
                        },
                        picture: {
                            type: 'string',
                            description: 'Profile picture URL'
                        },
                        isEmailVerified: {
                            type: 'boolean',
                            description: 'Email verification status'
                        }
                    }
                },
                AuthResponse: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            description: 'Operation success status'
                        },
                        message: {
                            type: 'string',
                            description: 'Response message'
                        },
                        data: {
                            type: 'object',
                            properties: {
                                token: {
                                    type: 'string',
                                    description: 'JWT authentication token'
                                },
                                user: {
                                    $ref: '#/components/schemas/User'
                                }
                            }
                        }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            description: 'Operation success status'
                        },
                        message: {
                            type: 'string',
                            description: 'Error message'
                        }
                    }
                }
            },
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
                googleOAuth: {
                    type: 'oauth2',
                    flows: {
                        authorizationCode: {
                            authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
                            tokenUrl: 'https://oauth2.googleapis.com/token',
                            scopes: {
                                'profile': 'View your basic profile info',
                                'email': 'View your email address'
                            }
                        }
                    }
                }
            }
        },
        tags: [
            {
                name: 'Authentication',
                description: 'Authentication endpoints including local and Google OAuth2'
            },
            {
                name: 'Users',
                description: 'User management endpoints'
            }
        ]
    },
    apis: [
        './src/routes/*.js',
        './src/models/*.js',
    ],
};

const specs = swaggerJsdoc(options);
module.exports = specs;
