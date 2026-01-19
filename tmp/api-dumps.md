# API Dumps

## EAGER API

```js
{
  path: 'api',
  type: 'object',
  wrapper: {
    materialized: null,
    inFlight: null,
    ownKeys: [ 'math', 'string', 'logger', 'subfolder', [length]: 4 ],
    descriptors: {
      math: {
        value: {},
        writable: true,
        enumerable: true,
        configurable: true
      },
      string: {
        value: {},
        writable: true,
        enumerable: true,
        configurable: true
      },
      logger: {
        value: <ref *1> [Function: unifiedProxyTarget] {
          [length]: 0,
          [name]: 'unifiedProxyTarget',
          [prototype]: { [constructor]: [Circular *1] }
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      subfolder: {
        value: {},
        writable: true,
        enumerable: true,
        configurable: true
      }
    },
    inspect: '{\n' +
      '  math: {},\n' +
      '  string: {},\n' +
      '  logger: <ref *1> [Function: unifiedProxyTarget] {\n' +
      '    [length]: 0,\n' +
      "    [name]: 'unifiedProxyTarget',\n" +
      '    [prototype]: { [constructor]: [Circular *1] }\n' +
      '  },\n' +
      '  subfolder: {}\n' +
      '}'
  },
  impl: {
    type: 'null',
    ownKeys: [ [length]: 0 ],
    descriptors: null,
    inspect: 'null'
  },
  wrapperProps: {
    math: {
      path: 'api.math',
      type: 'object',
      wrapper: {
        materialized: true,
        inFlight: false,
        ownKeys: [
          '__impl',
          '__setImpl',
          '__getState',
          '__materialize',
          '_impl',
          '_state',
          [length]: 6
        ],
        descriptors: null,
        inspect: null
      },
      impl: {
        type: 'object',
        ownKeys: [ 'add', 'multiply', 'divide', 'advanced', [length]: 4 ],
        descriptors: {
          add: {
            value: [Function: add] { [length]: 2, [name]: 'add' },
            writable: true,
            enumerable: true,
            configurable: true
          },
          multiply: {
            value: [Function: multiply] { [length]: 2, [name]: 'multiply' },
            writable: true,
            enumerable: true,
            configurable: true
          },
          divide: {
            value: [Function: divide] { [length]: 2, [name]: 'divide' },
            writable: true,
            enumerable: true,
            configurable: true
          },
          advanced: {
            value: {},
            writable: true,
            enumerable: true,
            configurable: true
          }
        },
        inspect: '{\n' +
          "  add: [Function: add] { [length]: 2, [name]: 'add' },\n" +
          "  multiply: [Function: multiply] { [length]: 2, [name]: 'multiply' },\n" +
          "  divide: [Function: divide] { [length]: 2, [name]: 'divide' },\n" +
          '  advanced: {}\n' +
          '}'
      },
      wrapperProps: {},
      implProps: {
        add: {
          path: 'api.math.add',
          type: 'function',
          wrapper: {
            materialized: null,
            inFlight: null,
            ownKeys: [ 'length', 'name', [length]: 2 ],
            descriptors: {
              length: {
                value: 2,
                writable: false,
                enumerable: false,
                configurable: true
              },
              name: {
                value: 'add',
                writable: false,
                enumerable: false,
                configurable: true
              }
            },
            inspect: "[Function: add] { [length]: 2, [name]: 'add' }"
          },
          impl: {
            type: 'null',
            ownKeys: [ [length]: 0 ],
            descriptors: null,
            inspect: 'null'
          },
          wrapperProps: {
            length: { type: 'number', value: 2 },
            name: { type: 'string', value: 'add' }
          },
          implProps: {}
        },
        multiply: {
          path: 'api.math.multiply',
          type: 'function',
          wrapper: {
            materialized: null,
            inFlight: null,
            ownKeys: [ 'length', 'name', [length]: 2 ],
            descriptors: {
              length: {
                value: 2,
                writable: false,
                enumerable: false,
                configurable: true
              },
              name: {
                value: 'multiply',
                writable: false,
                enumerable: false,
                configurable: true
              }
            },
            inspect: "[Function: multiply] { [length]: 2, [name]: 'multiply' }"
          },
          impl: {
            type: 'null',
            ownKeys: [ [length]: 0 ],
            descriptors: null,
            inspect: 'null'
          },
          wrapperProps: {
            length: { type: 'number', value: 2 },
            name: { type: 'string', value: 'multiply' }
          },
          implProps: {}
        },
        divide: {
          path: 'api.math.divide',
          type: 'function',
          wrapper: {
            materialized: null,
            inFlight: null,
            ownKeys: [ 'length', 'name', [length]: 2 ],
            descriptors: {
              length: {
                value: 2,
                writable: false,
                enumerable: false,
                configurable: true
              },
              name: {
                value: 'divide',
                writable: false,
                enumerable: false,
                configurable: true
              }
            },
            inspect: "[Function: divide] { [length]: 2, [name]: 'divide' }"
          },
          impl: {
            type: 'null',
            ownKeys: [ [length]: 0 ],
            descriptors: null,
            inspect: 'null'
          },
          wrapperProps: {
            length: { type: 'number', value: 2 },
            name: { type: 'string', value: 'divide' }
          },
          implProps: {}
        },
        advanced: {
          path: 'api.math.advanced',
          type: 'object',
          wrapper: {
            materialized: null,
            inFlight: null,
            ownKeys: [ [length]: 0 ],
            descriptors: {},
            inspect: '{}'
          },
          impl: {
            type: 'null',
            ownKeys: [ [length]: 0 ],
            descriptors: null,
            inspect: 'null'
          },
          wrapperProps: {},
          implProps: {}
        }
      }
    },
    string: {
      path: 'api.string',
      type: 'object',
      wrapper: {
        materialized: true,
        inFlight: false,
        ownKeys: [
          '__impl',
          '__setImpl',
          '__getState',
          '__materialize',
          '_impl',
          '_state',
          [length]: 6
        ],
        descriptors: null,
        inspect: null
      },
      impl: {
        type: 'object',
        ownKeys: [ 'upper', 'lower', 'reverse', [length]: 3 ],
        descriptors: {
          upper: {
            value: [Function: upper] { [length]: 1, [name]: 'upper' },
            writable: true,
            enumerable: true,
            configurable: true
          },
          lower: {
            value: [Function: lower] { [length]: 1, [name]: 'lower' },
            writable: true,
            enumerable: true,
            configurable: true
          },
          reverse: {
            value: [Function: reverse] { [length]: 1, [name]: 'reverse' },
            writable: true,
            enumerable: true,
            configurable: true
          }
        },
        inspect: '{\n' +
          "  upper: [Function: upper] { [length]: 1, [name]: 'upper' },\n" +
          "  lower: [Function: lower] { [length]: 1, [name]: 'lower' },\n" +
          "  reverse: [Function: reverse] { [length]: 1, [name]: 'reverse' }\n" +
          '}'
      },
      wrapperProps: {},
      implProps: {
        upper: {
          path: 'api.string.upper',
          type: 'function',
          wrapper: {
            materialized: null,
            inFlight: null,
            ownKeys: [ 'length', 'name', [length]: 2 ],
            descriptors: {
              length: {
                value: 1,
                writable: false,
                enumerable: false,
                configurable: true
              },
              name: {
                value: 'upper',
                writable: false,
                enumerable: false,
                configurable: true
              }
            },
            inspect: "[Function: upper] { [length]: 1, [name]: 'upper' }"
          },
          impl: {
            type: 'null',
            ownKeys: [ [length]: 0 ],
            descriptors: null,
            inspect: 'null'
          },
          wrapperProps: {
            length: { type: 'number', value: 1 },
            name: { type: 'string', value: 'upper' }
          },
          implProps: {}
        },
        lower: {
          path: 'api.string.lower',
          type: 'function',
          wrapper: {
            materialized: null,
            inFlight: null,
            ownKeys: [ 'length', 'name', [length]: 2 ],
            descriptors: {
              length: {
                value: 1,
                writable: false,
                enumerable: false,
                configurable: true
              },
              name: {
                value: 'lower',
                writable: false,
                enumerable: false,
                configurable: true
              }
            },
            inspect: "[Function: lower] { [length]: 1, [name]: 'lower' }"
          },
          impl: {
            type: 'null',
            ownKeys: [ [length]: 0 ],
            descriptors: null,
            inspect: 'null'
          },
          wrapperProps: {
            length: { type: 'number', value: 1 },
            name: { type: 'string', value: 'lower' }
          },
          implProps: {}
        },
        reverse: {
          path: 'api.string.reverse',
          type: 'function',
          wrapper: {
            materialized: null,
            inFlight: null,
            ownKeys: [ 'length', 'name', [length]: 2 ],
            descriptors: {
              length: {
                value: 1,
                writable: false,
                enumerable: false,
                configurable: true
              },
              name: {
                value: 'reverse',
                writable: false,
                enumerable: false,
                configurable: true
              }
            },
            inspect: "[Function: reverse] { [length]: 1, [name]: 'reverse' }"
          },
          impl: {
            type: 'null',
            ownKeys: [ [length]: 0 ],
            descriptors: null,
            inspect: 'null'
          },
          wrapperProps: {
            length: { type: 'number', value: 1 },
            name: { type: 'string', value: 'reverse' }
          },
          implProps: {}
        }
      }
    },
    logger: {
      path: 'api.logger',
      type: 'function',
      wrapper: {
        materialized: true,
        inFlight: false,
        ownKeys: [
          '__impl',
          '__setImpl',
          '__getState',
          '__materialize',
          '_impl',
          '_state',
          [length]: 6
        ],
        descriptors: null,
        inspect: null
      },
      impl: {
        type: 'function',
        ownKeys: [ 'length', 'name', 'prototype', 'utils', [length]: 4 ],
        descriptors: {
          length: {
            value: 1,
            writable: false,
            enumerable: false,
            configurable: true
          },
          name: {
            value: 'logger_main',
            writable: false,
            enumerable: false,
            configurable: true
          },
          prototype: {
            value: <ref *2> {
              [constructor]: [Function: logger_main] {
                [length]: 1,
                [name]: 'logger_main',
                [prototype]: [Circular *2],
                utils: {}
              }
            },
            writable: true,
            enumerable: false,
            configurable: false
          },
          utils: {
            value: {},
            writable: true,
            enumerable: true,
            configurable: true
          }
        },
        inspect: '<ref *1> [Function: logger_main] {\n' +
          '  [length]: 1,\n' +
          "  [name]: 'logger_main',\n" +
          '  [prototype]: { [constructor]: [Circular *1] },\n' +
          '  utils: {}\n' +
          '}'
      },
      wrapperProps: {},
      implProps: {
        length: { type: 'number', value: 1 },
        name: { type: 'string', value: 'logger_main' },
        prototype: {
          path: 'api.logger.prototype',
          type: 'object',
          wrapper: {
            materialized: null,
            inFlight: null,
            ownKeys: [ 'constructor', [length]: 1 ],
            descriptors: {
              constructor: {
                value: <ref *3> [Function: logger_main] {
                  [length]: 1,
                  [name]: 'logger_main',
                  [prototype]: <ref *2> { [constructor]: [Circular *3] },
                  utils: {}
                },
                writable: true,
                enumerable: false,
                configurable: true
              }
            },
            inspect: '<ref *1> {\n' +
              '  [constructor]: [Function: logger_main] {\n' +
              '    [length]: 1,\n' +
              "    [name]: 'logger_main',\n" +
              '    [prototype]: [Circular *1],\n' +
              '    utils: {}\n' +
              '  }\n' +
              '}'
          },
          impl: {
            type: 'null',
            ownKeys: [ [length]: 0 ],
            descriptors: null,
            inspect: 'null'
          },
          wrapperProps: {
            constructor: {
              path: 'api.logger.prototype.constructor',
              type: 'function',
              wrapper: {
                materialized: null,
                inFlight: null,
                ownKeys: [ 'length', 'name', 'prototype', 'utils', [length]: 4 ],
                descriptors: {
                  length: {
                    value: 1,
                    writable: false,
                    enumerable: false,
                    configurable: true
                  },
                  name: {
                    value: 'logger_main',
                    writable: false,
                    enumerable: false,
                    configurable: true
                  },
                  prototype: {
                    value: <ref *2> {
                      [constructor]: <ref *3> [Function: logger_main] {
                        [length]: 1,
                        [name]: 'logger_main',
                        [prototype]: [Circular *2],
                        utils: {}
                      }
                    },
                    writable: true,
                    enumerable: false,
                    configurable: false
                  },
                  utils: {
                    value: {},
                    writable: true,
                    enumerable: true,
                    configurable: true
                  }
                },
                inspect: '<ref *1> [Function: logger_main] {\n' +
                  '  [length]: 1,\n' +
                  "  [name]: 'logger_main',\n" +
                  '  [prototype]: { [constructor]: [Circular *1] },\n' +
                  '  utils: {}\n' +
                  '}'
              },
              impl: {
                type: 'null',
                ownKeys: [ [length]: 0 ],
                descriptors: null,
                inspect: 'null'
              },
              wrapperProps: {
                length: { type: 'number', value: 1 },
                name: { type: 'string', value: 'logger_main' },
                prototype: {
                  path: 'api.logger.prototype.constructor.prototype',
                  cycle: true
                },
                utils: {
                  path: 'api.logger.prototype.constructor.utils',
                  type: 'object',
                  wrapper: {
                    materialized: null,
                    inFlight: null,
                    ownKeys: [ [length]: 0 ],
                    descriptors: {},
                    inspect: '{}'
                  },
                  impl: {
                    type: 'null',
                    ownKeys: [ [length]: 0 ],
                    descriptors: null,
                    inspect: 'null'
                  },
                  wrapperProps: {},
                  implProps: {}
                }
              },
              implProps: {}
            }
          },
          implProps: {}
        },
        utils: { path: 'api.logger.utils', cycle: true }
      }
    },
    subfolder: {
      path: 'api.subfolder',
      type: 'object',
      wrapper: {
        materialized: true,
        inFlight: false,
        ownKeys: [
          '__impl',
          '__setImpl',
          '__getState',
          '__materialize',
          '_impl',
          '_state',
          [length]: 6
        ],
        descriptors: null,
        inspect: null
      },
      impl: {
        type: 'object',
        ownKeys: [ 'logger', [length]: 1 ],
        descriptors: {
          logger: {
            value: <ref *4> [Function: subfolder_logger_main] {
              [length]: 1,
              [name]: 'subfolder_logger_main',
              [prototype]: { [constructor]: [Circular *4] }
            },
            writable: true,
            enumerable: true,
            configurable: true
          }
        },
        inspect: '{\n' +
          '  logger: <ref *1> [Function: subfolder_logger_main] {\n' +
          '    [length]: 1,\n' +
          "    [name]: 'subfolder_logger_main',\n" +
          '    [prototype]: { [constructor]: [Circular *1] }\n' +
          '  }\n' +
          '}'
      },
      wrapperProps: {},
      implProps: {
        logger: {
          path: 'api.subfolder.logger',
          type: 'function',
          wrapper: {
            materialized: null,
            inFlight: null,
            ownKeys: [ 'length', 'name', 'prototype', [length]: 3 ],
            descriptors: {
              length: {
                value: 1,
                writable: false,
                enumerable: false,
                configurable: true
              },
              name: {
                value: 'subfolder_logger_main',
                writable: false,
                enumerable: false,
                configurable: true
              },
              prototype: {
                value: <ref *5> {
                  [constructor]: <ref *4> [Function: subfolder_logger_main] {
                    [length]: 1,
                    [name]: 'subfolder_logger_main',
                    [prototype]: [Circular *5]
                  }
                },
                writable: true,
                enumerable: false,
                configurable: false
              }
            },
            inspect: '<ref *1> [Function: subfolder_logger_main] {\n' +
              '  [length]: 1,\n' +
              "  [name]: 'subfolder_logger_main',\n" +
              '  [prototype]: { [constructor]: [Circular *1] }\n' +
              '}'
          },
          impl: {
            type: 'null',
            ownKeys: [ [length]: 0 ],
            descriptors: null,
            inspect: 'null'
          },
          wrapperProps: {
            length: { type: 'number', value: 1 },
            name: { type: 'string', value: 'subfolder_logger_main' },
            prototype: {
              path: 'api.subfolder.logger.prototype',
              type: 'object',
              wrapper: {
                materialized: null,
                inFlight: null,
                ownKeys: [ 'constructor', [length]: 1 ],
                descriptors: {
                  constructor: {
                    value: <ref *4> [Function: subfolder_logger_main] {
                      [length]: 1,
                      [name]: 'subfolder_logger_main',
                      [prototype]: <ref *5> { [constructor]: [Circular *4] }
                    },
                    writable: true,
                    enumerable: false,
                    configurable: true
                  }
                },
                inspect: '<ref *1> {\n' +
                  '  [constructor]: [Function: subfolder_logger_main] {\n' +
                  '    [length]: 1,\n' +
                  "    [name]: 'subfolder_logger_main',\n" +
                  '    [prototype]: [Circular *1]\n' +
                  '  }\n' +
                  '}'
              },
              impl: {
                type: 'null',
                ownKeys: [ [length]: 0 ],
                descriptors: null,
                inspect: 'null'
              },
              wrapperProps: {
                constructor: {
                  path: 'api.subfolder.logger.prototype.constructor',
                  cycle: true
                }
              },
              implProps: {}
            }
          },
          implProps: {}
        }
      }
    }
  },
  implProps: {}
}
```

## LAZY API

```js


{
  path: 'api',
  type: 'object',
  wrapper: {
    materialized: null,
    inFlight: null,
    ownKeys: [ 'math', 'string', 'logger', 'subfolder', [length]: 4 ],
    descriptors: {
      math: {
        value: {},
        writable: true,
        enumerable: true,
        configurable: true
      },
      string: {
        value: {},
        writable: true,
        enumerable: true,
        configurable: true
      },
      logger: {
        value: <ref *1> [Function: unifiedProxyTarget] {
          [length]: 0,
          [name]: 'unifiedProxyTarget',
          [prototype]: { [constructor]: [Circular *1] }
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      subfolder: {
        value: {},
        writable: true,
        enumerable: true,
        configurable: true
      }
    },
    inspect: '{\n' +
      '  math: {},\n' +
      '  string: {},\n' +
      '  logger: <ref *1> [Function: unifiedProxyTarget] {\n' +
      '    [length]: 0,\n' +
      "    [name]: 'unifiedProxyTarget',\n" +
      '    [prototype]: { [constructor]: [Circular *1] }\n' +
      '  },\n' +
      '  subfolder: {}\n' +
      '}'
  },
  impl: {
    type: 'null',
    ownKeys: [ [length]: 0 ],
    descriptors: null,
    inspect: 'null'
  },
  wrapperProps: {
    math: {
      path: 'api.math',
      type: 'object',
      wrapper: {
        materialized: true,
        inFlight: false,
        ownKeys: [
          '__impl',
          '__setImpl',
          '__getState',
          '__materialize',
          '_impl',
          '_state',
          [length]: 6
        ],
        descriptors: null,
        inspect: null
      },
      impl: {
        type: 'object',
        ownKeys: [ [length]: 0 ],
        descriptors: {},
        inspect: '{}'
      },
      wrapperProps: {},
      implProps: {}
    },
    string: {
      path: 'api.string',
      type: 'object',
      wrapper: {
        materialized: true,
        inFlight: false,
        ownKeys: [
          '__impl',
          '__setImpl',
          '__getState',
          '__materialize',
          '_impl',
          '_state',
          [length]: 6
        ],
        descriptors: null,
        inspect: null
      },
      impl: {
        type: 'object',
        ownKeys: [ [length]: 0 ],
        descriptors: {},
        inspect: '{}'
      },
      wrapperProps: {},
      implProps: {}
    },
    logger: {
      path: 'api.logger',
      type: 'function',
      wrapper: {
        materialized: true,
        inFlight: false,
        ownKeys: [
          '__impl',
          '__setImpl',
          '__getState',
          '__materialize',
          '_impl',
          '_state',
          [length]: 6
        ],
        descriptors: null,
        inspect: null
      },
      impl: {
        type: 'function',
        ownKeys: [ 'length', 'name', 'prototype', [length]: 3 ],
        descriptors: {
          length: {
            value: 1,
            writable: false,
            enumerable: false,
            configurable: true
          },
          name: {
            value: 'logger_main',
            writable: false,
            enumerable: false,
            configurable: true
          },
          prototype: {
            value: <ref *2> {
              [constructor]: [Function: logger_main] {
                [length]: 1,
                [name]: 'logger_main',
                [prototype]: [Circular *2]
              }
            },
            writable: true,
            enumerable: false,
            configurable: false
          }
        },
        inspect: '<ref *1> [Function: logger_main] {\n' +
          '  [length]: 1,\n' +
          "  [name]: 'logger_main',\n" +
          '  [prototype]: { [constructor]: [Circular *1] }\n' +
          '}'
      },
      wrapperProps: {},
      implProps: {
        length: { type: 'number', value: 1 },
        name: { type: 'string', value: 'logger_main' },
        prototype: {
          path: 'api.logger.prototype',
          type: 'object',
          wrapper: {
            materialized: null,
            inFlight: null,
            ownKeys: [ 'constructor', [length]: 1 ],
            descriptors: {
              constructor: {
                value: <ref *3> [Function: logger_main] {
                  [length]: 1,
                  [name]: 'logger_main',
                  [prototype]: <ref *2> { [constructor]: [Circular *3] }
                },
                writable: true,
                enumerable: false,
                configurable: true
              }
            },
            inspect: '<ref *1> {\n' +
              '  [constructor]: [Function: logger_main] {\n' +
              '    [length]: 1,\n' +
              "    [name]: 'logger_main',\n" +
              '    [prototype]: [Circular *1]\n' +
              '  }\n' +
              '}'
          },
          impl: {
            type: 'null',
            ownKeys: [ [length]: 0 ],
            descriptors: null,
            inspect: 'null'
          },
          wrapperProps: {
            constructor: {
              path: 'api.logger.prototype.constructor',
              type: 'function',
              wrapper: {
                materialized: null,
                inFlight: null,
                ownKeys: [ 'length', 'name', 'prototype', [length]: 3 ],
                descriptors: {
                  length: {
                    value: 1,
                    writable: false,
                    enumerable: false,
                    configurable: true
                  },
                  name: {
                    value: 'logger_main',
                    writable: false,
                    enumerable: false,
                    configurable: true
                  },
                  prototype: {
                    value: <ref *2> {
                      [constructor]: <ref *3> [Function: logger_main] {
                        [length]: 1,
                        [name]: 'logger_main',
                        [prototype]: [Circular *2]
                      }
                    },
                    writable: true,
                    enumerable: false,
                    configurable: false
                  }
                },
                inspect: '<ref *1> [Function: logger_main] {\n' +
                  '  [length]: 1,\n' +
                  "  [name]: 'logger_main',\n" +
                  '  [prototype]: { [constructor]: [Circular *1] }\n' +
                  '}'
              },
              impl: {
                type: 'null',
                ownKeys: [ [length]: 0 ],
                descriptors: null,
                inspect: 'null'
              },
              wrapperProps: {
                length: { type: 'number', value: 1 },
                name: { type: 'string', value: 'logger_main' },
                prototype: {
                  path: 'api.logger.prototype.constructor.prototype',
                  cycle: true
                }
              },
              implProps: {}
            }
          },
          implProps: {}
        }
      }
    },
    subfolder: {
      path: 'api.subfolder',
      type: 'object',
      wrapper: {
        materialized: true,
        inFlight: false,
        ownKeys: [
          '__impl',
          '__setImpl',
          '__getState',
          '__materialize',
          '_impl',
          '_state',
          [length]: 6
        ],
        descriptors: null,
        inspect: null
      },
      impl: {
        type: 'object',
        ownKeys: [ [length]: 0 ],
        descriptors: {},
        inspect: '{}'
      },
      wrapperProps: {},
      implProps: {}
    }
  },
  implProps: {}
}

```