// Server-side tool definitions for OpenAI function calling.
// This is a copy kept separate from packages/editor to avoid importing
// React-dependent code (@pascal-app/core) into server components.

export const toolDefinitions = [
  // === Creation Tools ===
  {
    type: 'function' as const,
    function: {
      name: 'create_walls',
      description:
        'Create one or more walls. Walls are defined by start and end [x, z] points in meters. To form a room, walls must share exact endpoints. Returns created wall IDs.',
      parameters: {
        type: 'object',
        properties: {
          walls: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                start: {
                  type: 'array',
                  items: { type: 'number' },
                  minItems: 2,
                  maxItems: 2,
                  description: '[x, z] start point in meters',
                },
                end: {
                  type: 'array',
                  items: { type: 'number' },
                  minItems: 2,
                  maxItems: 2,
                  description: '[x, z] end point in meters',
                },
                thickness: {
                  type: 'number',
                  description: 'Wall thickness in meters (default 0.2)',
                },
                height: { type: 'number', description: 'Wall height in meters (default 2.8)' },
              },
              required: ['start', 'end'],
            },
            description: 'Array of walls to create',
          },
        },
        required: ['walls'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_slab',
      description:
        'Create a floor slab from a polygon of [x, z] points. Usually matches room boundaries.',
      parameters: {
        type: 'object',
        properties: {
          polygon: {
            type: 'array',
            items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
            description: 'Array of [x, z] points defining the slab boundary',
          },
          elevation: { type: 'number', description: 'Slab elevation in meters (default 0.05)' },
        },
        required: ['polygon'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_ceiling',
      description: 'Create a ceiling from a polygon of [x, z] points.',
      parameters: {
        type: 'object',
        properties: {
          polygon: {
            type: 'array',
            items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
            description: 'Array of [x, z] points defining the ceiling boundary',
          },
          height: { type: 'number', description: 'Ceiling height in meters (default 2.5)' },
        },
        required: ['polygon'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_doors',
      description:
        'Place doors on walls. Requires wall IDs (use get_scene_info first). Position is 0-1 parametric along the wall.',
      parameters: {
        type: 'object',
        properties: {
          doors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                wallId: { type: 'string', description: 'ID of the wall to place the door on' },
                position: {
                  type: 'number',
                  description: 'Parametric position along wall (0-1, default 0.5 = center)',
                },
                width: { type: 'number', description: 'Door width in meters (default 0.9)' },
                height: { type: 'number', description: 'Door height in meters (default 2.1)' },
                side: {
                  type: 'string',
                  enum: ['front', 'back'],
                  description: 'Which side of the wall (default front)',
                },
                hingesSide: {
                  type: 'string',
                  enum: ['left', 'right'],
                  description: 'Hinge side (default left)',
                },
                swingDirection: {
                  type: 'string',
                  enum: ['inward', 'outward'],
                  description: 'Swing direction (default inward)',
                },
              },
              required: ['wallId'],
            },
          },
        },
        required: ['doors'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_windows',
      description:
        'Place windows on walls. Requires wall IDs (use get_scene_info first). Position is 0-1 parametric along the wall.',
      parameters: {
        type: 'object',
        properties: {
          windows: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                wallId: { type: 'string', description: 'ID of the wall to place the window on' },
                position: {
                  type: 'number',
                  description: 'Parametric position along wall (0-1, default 0.5 = center)',
                },
                width: { type: 'number', description: 'Window width in meters (default 1.5)' },
                height: { type: 'number', description: 'Window height in meters (default 1.5)' },
                sillHeight: {
                  type: 'number',
                  description: 'Height from floor to bottom of window in meters (default 0.9)',
                },
                side: {
                  type: 'string',
                  enum: ['front', 'back'],
                  description: 'Which side of the wall (default front)',
                },
              },
              required: ['wallId'],
            },
          },
        },
        required: ['windows'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_zones',
      description: 'Create labeled zones (room labels) with polygon boundaries and colors.',
      parameters: {
        type: 'object',
        properties: {
          zones: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Zone/room name' },
                polygon: {
                  type: 'array',
                  items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
                  description: 'Array of [x, z] points defining the zone boundary',
                },
                color: { type: 'string', description: 'Hex color (default auto-assigned)' },
              },
              required: ['name', 'polygon'],
            },
          },
        },
        required: ['zones'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'place_items',
      description:
        'Place furniture/items from the catalog. Use get_catalog to see available items. Position is [x, y, z] in meters.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                catalogId: { type: 'string', description: 'Item ID from the catalog' },
                position: {
                  type: 'array',
                  items: { type: 'number' },
                  minItems: 3,
                  maxItems: 3,
                  description: '[x, y, z] position in meters',
                },
                rotation: { type: 'number', description: 'Y-axis rotation in degrees (default 0)' },
                wallId: { type: 'string', description: 'Wall ID for wall-attached items' },
                wallT: {
                  type: 'number',
                  description: 'Parametric position along wall (0-1) for wall-attached items',
                },
                side: {
                  type: 'string',
                  enum: ['front', 'back'],
                  description: 'Side of wall for wall-attached items',
                },
              },
              required: ['catalogId', 'position'],
            },
          },
        },
        required: ['items'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_roof',
      description: 'Create a roof with one or more segments.',
      parameters: {
        type: 'object',
        properties: {
          position: {
            type: 'array',
            items: { type: 'number' },
            minItems: 3,
            maxItems: 3,
            description: '[x, y, z] center position of the roof',
          },
          rotation: { type: 'number', description: 'Y-axis rotation in radians (default 0)' },
          segments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                roofType: {
                  type: 'string',
                  enum: ['hip', 'gable', 'shed', 'gambrel', 'dutch', 'mansard', 'flat'],
                  description: 'Roof shape type (default gable)',
                },
                width: { type: 'number', description: 'Footprint width in meters (default 8)' },
                depth: { type: 'number', description: 'Footprint depth in meters (default 6)' },
                wallHeight: {
                  type: 'number',
                  description: 'Height of walls below roof (default 0.5)',
                },
                roofHeight: { type: 'number', description: 'Height of roof peak (default 2.5)' },
                overhang: { type: 'number', description: 'Eave overhang distance (default 0.3)' },
              },
            },
            description: 'Roof segments (default one gable segment)',
          },
        },
        required: ['position'],
      },
    },
  },
  // === Modification Tools ===
  {
    type: 'function' as const,
    function: {
      name: 'update_nodes',
      description:
        'Update properties of existing nodes. Can reposition walls, resize doors/windows, rename zones, etc.',
      parameters: {
        type: 'object',
        properties: {
          updates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Node ID to update' },
                data: { type: 'object', description: 'Partial properties to update on the node' },
              },
              required: ['id', 'data'],
            },
          },
        },
        required: ['updates'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_nodes',
      description: 'Delete nodes by their IDs.',
      parameters: {
        type: 'object',
        properties: {
          nodeIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of node IDs to delete',
          },
        },
        required: ['nodeIds'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'set_site_boundary',
      description:
        'Set the site/land boundary polygon. Use this when a user specifies their plot dimensions.',
      parameters: {
        type: 'object',
        properties: {
          polygon: {
            type: 'array',
            items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
            description:
              'Array of [x, z] points defining the site boundary. For a 20x30m plot: [[0,0],[20,0],[20,30],[0,30]]',
          },
        },
        required: ['polygon'],
      },
    },
  },
  // === Query Tools ===
  {
    type: 'function' as const,
    function: {
      name: 'get_scene_info',
      description:
        'Get information about all nodes on the current level. Returns wall IDs (needed for doors/windows), zones, slabs, items, etc.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_catalog',
      description:
        'Get available furniture/items from the catalog, optionally filtered by category.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['furniture', 'appliance', 'bathroom', 'kitchen', 'outdoor', 'window', 'door'],
            description: 'Filter by category (optional, returns all if omitted)',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_site_info',
      description: 'Get site boundary dimensions and info for land-aware design.',
      parameters: { type: 'object', properties: {} },
    },
  },
  // === Scene Management ===
  {
    type: 'function' as const,
    function: {
      name: 'create_level',
      description: 'Add a new floor/level to the building for multi-story houses.',
      parameters: {
        type: 'object',
        properties: {
          level: {
            type: 'number',
            description: 'Level number (e.g., 1 for first floor, 2 for second)',
          },
        },
        required: ['level'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'clear_level',
      description: 'Remove all nodes on the current level to start fresh.',
      parameters: { type: 'object', properties: {} },
    },
  },
]
