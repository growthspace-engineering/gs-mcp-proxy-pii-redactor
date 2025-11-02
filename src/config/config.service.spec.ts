import * as fs from 'fs';
import * as path from 'path';

import axios from 'axios';

import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from './config.service';

jest.mock('fs');
jest.mock('axios');

describe('ConfigService', () => {
  let service: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ ConfigService ]
    }).compile();

    service = module.get<ConfigService>(ConfigService);
    jest.clearAllMocks();
  });

  describe('load from file', () => {
    it('should load config from file with absolute path', async () => {
      const mockConfig = {
        mcpProxy: {
          type: 'sse' as const,
          options: {}
        },
        mcpServers: {}
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

      const result = await service.load('/absolute/path/config.json');

      expect(fs.readFileSync).toHaveBeenCalledWith('/absolute/path/config.json', 'utf-8');
      expect(result).toEqual(mockConfig);
    });

    it('should load config from file with relative path', async () => {
      const mockConfig = {
        mcpProxy: {
          type: 'sse' as const,
          options: {}
        },
        mcpServers: {}
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

      const result = await service.load('config.json');

      const expectedPath = path.join(process.cwd(), 'config.json');
      expect(fs.readFileSync).toHaveBeenCalledWith(expectedPath, 'utf-8');
      expect(result).toEqual(mockConfig);
    });

    it('should set default type to sse if not provided', async () => {
      const mockConfig = {
        mcpProxy: {
          options: {}
        },
        mcpServers: {}
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

      const result = await service.load('config.json');

      expect(result.mcpProxy.type).toBe('sse');
    });

    it('should throw error if mcpProxy is missing', async () => {
      const mockConfig = {
        mcpServers: {}
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

      await expect(service.load('config.json')).rejects.toThrow('mcpProxy is required');
    });
  });

  describe('load from URL', () => {
    it('should load config from HTTP URL', async () => {
      const mockConfig = {
        mcpProxy: {
          type: 'sse' as const,
          options: {}
        },
        mcpServers: {}
      };

      (axios.get as jest.Mock).mockResolvedValue({ data: mockConfig });

      const result = await service.load('http://example.com/config.json');

      expect(axios.get).toHaveBeenCalledWith('http://example.com/config.json', { httpsAgent: undefined });
      expect(result).toEqual(mockConfig);
    });

    it('should load config from HTTPS URL', async () => {
      const mockConfig = {
        mcpProxy: {
          type: 'sse' as const,
          options: {}
        },
        mcpServers: {}
      };

      (axios.get as jest.Mock).mockResolvedValue({ data: mockConfig });

      const result = await service.load('https://example.com/config.json');

      expect(axios.get).toHaveBeenCalledWith('https://example.com/config.json', { httpsAgent: undefined });
      expect(result).toEqual(mockConfig);
    });

    it('should handle insecure flag for HTTPS', async () => {
      const mockConfig = {
        mcpProxy: {
          type: 'sse' as const,
          options: {}
        },
        mcpServers: {}
      };

      (axios.get as jest.Mock).mockResolvedValue({ data: mockConfig });

      const result = await service.load('https://example.com/config.json', true);

      expect(axios.get).toHaveBeenCalled();
      const callArgs = (axios.get as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe('https://example.com/config.json');
      expect(callArgs[1]).toHaveProperty('httpsAgent');
      expect(result).toEqual(mockConfig);
    });
  });

  describe('environment variable expansion', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should expand environment variables in headers', async () => {
      process.env.API_KEY = 'test-api-key-123';
      process.env.TOKEN = 'test-token-456';

      const mockConfig = {
        mcpProxy: {
          type: 'sse' as const,
          options: {}
        },
        mcpServers: {
          testServer: {
            url: 'http://example.com',
            headers: {
              'X-API-Key': '${API_KEY}',
              'Authorization': 'Bearer ${TOKEN}'
            },
            options: {}
          }
        }
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

      const result = await service.load('config.json');

      expect(result.mcpServers.testServer.headers['X-API-Key']).toBe('test-api-key-123');
      expect(result.mcpServers.testServer.headers.Authorization).toBe('Bearer test-token-456');
    });

    it('should throw error if referenced environment variable is not set', async () => {
      const mockConfig = {
        mcpProxy: {
          type: 'sse' as const,
          options: {}
        },
        mcpServers: {
          testServer: {
            url: 'http://example.com',
            headers: {
              'X-API-Key': '${MISSING_VAR}'
            },
            options: {}
          }
        }
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

      await expect(service.load('config.json')).rejects.toThrow(
        'Environment variable MISSING_VAR referenced in header X-API-Key is not set'
      );
    });

    it('should handle multiple environment variables in same header', async () => {
      process.env.PREFIX = 'Bearer';
      process.env.TOKEN = 'token123';

      const mockConfig = {
        mcpProxy: {
          type: 'sse' as const,
          options: {}
        },
        mcpServers: {
          testServer: {
            url: 'http://example.com',
            headers: {
              'Authorization': '${PREFIX} ${TOKEN}'
            },
            options: {}
          }
        }
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

      const result = await service.load('config.json');

      expect(result.mcpServers.testServer.headers.Authorization).toBe('Bearer token123');
    });

    it('should not expand if no environment variables referenced', async () => {
      const mockConfig = {
        mcpProxy: {
          type: 'sse' as const,
          options: {}
        },
        mcpServers: {
          testServer: {
            url: 'http://example.com',
            headers: {
              'Content-Type': 'application/json'
            },
            options: {}
          }
        }
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

      const result = await service.load('config.json');

      expect(result.mcpServers.testServer.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('options inheritance', () => {
    it('should inherit authTokens from mcpProxy to mcpServers', async () => {
      const mockConfig = {
        mcpProxy: {
          type: 'sse' as const,
          options: {
            authTokens: [ 'token1', 'token2' ]
          }
        },
        mcpServers: {
          testServer: {
            url: 'http://example.com',
            options: {}
          }
        }
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

      const result = await service.load('config.json');

      expect(result.mcpServers.testServer.options.authTokens).toEqual([ 'token1', 'token2' ]);
    });

    it('should inherit panicIfInvalid from mcpProxy to mcpServers', async () => {
      const mockConfig = {
        mcpProxy: {
          type: 'sse' as const,
          options: {
            panicIfInvalid: true
          }
        },
        mcpServers: {
          testServer: {
            url: 'http://example.com',
            options: {}
          }
        }
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

      const result = await service.load('config.json');

      expect(result.mcpServers.testServer.options.panicIfInvalid).toBe(true);
    });

    it('should inherit logEnabled from mcpProxy to mcpServers', async () => {
      const mockConfig = {
        mcpProxy: {
          type: 'sse' as const,
          options: {
            logEnabled: false
          }
        },
        mcpServers: {
          testServer: {
            url: 'http://example.com',
            options: {}
          }
        }
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

      const result = await service.load('config.json');

      expect(result.mcpServers.testServer.options.logEnabled).toBe(false);
    });

    it('should not override existing options in mcpServers', async () => {
      const mockConfig = {
        mcpProxy: {
          type: 'sse' as const,
          options: {
            authTokens: [ 'parent-token' ],
            panicIfInvalid: true,
            logEnabled: false
          }
        },
        mcpServers: {
          testServer: {
            url: 'http://example.com',
            options: {
              authTokens: [ 'child-token' ],
              panicIfInvalid: false
            }
          }
        }
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

      const result = await service.load('config.json');

      expect(result.mcpServers.testServer.options.authTokens).toEqual([ 'child-token' ]);
      expect(result.mcpServers.testServer.options.panicIfInvalid).toBe(false);
      // logEnabled should still be inherited as it wasn't overridden
      expect(result.mcpServers.testServer.options.logEnabled).toBe(false);
    });

    it('should not inherit redaction options from mcpProxy to mcpServers', async () => {
      const mockConfig = {
        mcpProxy: {
          type: 'sse' as const,
          options: {
            redaction: {
              enabled: true,
              keys: [ 'key1' ]
            }
          }
        },
        mcpServers: {
          testServer: {
            url: 'http://example.com',
            options: {}
          }
        }
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

      const result = await service.load('config.json');

      // Redaction should NOT be inherited
      expect(result.mcpServers.testServer.options.redaction).toBeUndefined();
    });

    it('should handle multiple mcpServers with inheritance', async () => {
      const mockConfig = {
        mcpProxy: {
          type: 'sse' as const,
          options: {
            authTokens: [ 'token1' ],
            logEnabled: true
          }
        },
        mcpServers: {
          server1: {
            url: 'http://example1.com',
            options: {}
          },
          server2: {
            url: 'http://example2.com',
            options: {
              logEnabled: false
            }
          }
        }
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

      const result = await service.load('config.json');

      // server1 should inherit all
      expect(result.mcpServers.server1.options.authTokens).toEqual([ 'token1' ]);
      expect(result.mcpServers.server1.options.logEnabled).toBe(true);

      // server2 should inherit authTokens but keep its own logEnabled
      expect(result.mcpServers.server2.options.authTokens).toEqual([ 'token1' ]);
      expect(result.mcpServers.server2.options.logEnabled).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('should return loaded config', async () => {
      const mockConfig = {
        mcpProxy: {
          type: 'sse' as const,
          options: {}
        },
        mcpServers: {}
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

      await service.load('config.json');
      const result = service.getConfig();

      expect(result).toEqual(mockConfig);
    });

    it('should throw error if config not loaded', () => {
      expect(() => service.getConfig()).toThrow('Config not loaded');
    });
  });

  describe('edge cases', () => {
    it('should handle empty mcpServers object', async () => {
      const mockConfig = {
        mcpProxy: {
          type: 'sse' as const,
          options: {}
        }
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

      const result = await service.load('config.json');

      expect(result.mcpServers).toEqual({});
    });

    it('should initialize options if not provided in mcpProxy', async () => {
      const mockConfig = {
        mcpProxy: {
          type: 'sse' as const
        },
        mcpServers: {}
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

      const result = await service.load('config.json');

      expect(result.mcpProxy.options).toEqual({});
    });

    it('should initialize options if not provided in mcpServer', async () => {
      const mockConfig = {
        mcpProxy: {
          type: 'sse' as const,
          options: {}
        },
        mcpServers: {
          testServer: {
            url: 'http://example.com'
          }
        }
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

      const result = await service.load('config.json');

      expect(result.mcpServers.testServer.options).toBeDefined();
    });
  });
});

