import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Multi-Tenant SaaS API',
      version: '1.0.0',
      description: `Comprehensive API documentation for the Multi-Tenant SaaS platform. This API provides endpoints for authentication, user management, role-based access control, API key management, and more.

## 🔐 Authentication Required

To use the API endpoints, you need to authenticate:

1. **Get a JWT Token**: Log in using \`POST /api/auth/login\` to receive your JWT token
2. **Click "Authorize"**: Use the green "Authorize" button above to enter your token
3. **Enter Token**: 
   - For **Bearer Auth**: Enter your JWT token (without "Bearer " prefix)
   - For **API Key Auth**: Enter your API key
4. **Start Testing**: Click "Try it out" on any endpoint

**Note**: Your token will be saved in your browser for convenience.`,
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url:  `http://localhost`,
        description: 'Development server',
      },
      {
        url: 'https://api.example.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /api/auth/login endpoint',
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API Key obtained from the API Keys management section',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  example: 'VALIDATION_ERROR',
                },
                message: {
                  type: 'string',
                  example: 'Invalid input data',
                },
              },
            },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            firstName: {
              type: 'string',
              example: 'John',
            },
            lastName: {
              type: 'string',
              example: 'Doe',
            },
            roleId: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            clientId: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
            mustResetPassword: {
              type: 'boolean',
              example: false,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        ApiKey: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
              example: 'My API Key',
            },
            key: {
              type: 'string',
              description: 'Only returned when creating a new API key',
              example: 'ak_live_1234567890abcdef',
            },
            scopes: {
              type: 'array',
              items: {
                type: 'string',
              },
              example: ['users:read', 'users:write'],
            },
            allowedEndpoints: {
              type: 'array',
              items: {
                type: 'string',
              },
              example: ['/api/users', '/api/roles'],
            },
            rateLimitPerMinute: {
              type: 'integer',
              example: 100,
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            lastUsedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Role: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
              example: 'Administrator',
            },
            description: {
              type: 'string',
              example: 'Full access to all resources',
            },
            clientId: {
              type: 'string',
              format: 'uuid',
            },
            permissions: {
              type: 'array',
              items: {
                type: 'object',
              },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
      {
        apiKeyAuth: [],
      },
    ],
  },
  // Support both TypeScript (development) and JavaScript (production) files
  // Use absolute paths that work in both local and Docker environments
  // Note: Superadmin routes are filtered out after generation (see below)
  apis: [
    `${process.cwd()}/src/routers/*.ts`,
    `${process.cwd()}/src/routers/*.js`,
    `${process.cwd()}/src/controllers/*.ts`,
    `${process.cwd()}/src/controllers/*.js`,
    `${process.cwd()}/dist/routers/*.js`,
    `${process.cwd()}/dist/controllers/*.js`,
    // Docker paths
    '/app/src/routers/*.ts',
    '/app/src/routers/*.js',
    '/app/src/controllers/*.ts',
    '/app/src/controllers/*.js',
    '/app/dist/routers/*.js',
    '/app/dist/controllers/*.js',
  ],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let swaggerSpec: any;
try {
  swaggerSpec = swaggerJsdoc(options);
  
  // Remove superadmin paths from Swagger spec
  if (swaggerSpec.paths) {
    const pathsToRemove: string[] = [];
    for (const path in swaggerSpec.paths) {
      // Remove any paths that start with /api/super-admin
      if (path.startsWith('/api/super-admin')) {
        pathsToRemove.push(path);
      }
    }
    pathsToRemove.forEach(path => {
      delete swaggerSpec.paths[path];
    });
  }
} catch {
  // Create a minimal spec if generation fails
  swaggerSpec = {
    openapi: '3.0.0',
    info: {
      title: 'Multi-Tenant SaaS API',
      version: '1.0.0',
      description: 'API documentation - Error loading full spec',
    },
    paths: {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

export { swaggerSpec };

