/*eslint-env mocha */

'use strict'

require('should')
const assert = require('assert')
const os = require('os')
const SMConfig = require('../index')
const SMHelper = require('smhelper')

const expected = require('./resources/expected')

describe('SMConfig.js', function() {

    it('SMConfig should export a class', function() {
        SMConfig.should.be.type('function')
        SMConfig.prototype.should.be.type('object')

        const config = new SMConfig({default: {}})
        assert.ok(config)

        config.all.should.be.type('object')
        config.environment.should.be.type('string')
        config.get.should.be.type('function')
    })

    describe('Constructor method', function() {
        let originalEnv

        const params = expected.params
        const defaultExpect = expected.defaultExpect
        const testenv1Expect = expected.testenv1Expect
        const testenv2Expect = expected.testenv2Expect
        const addendumExpect = expected.addendumExpect

        // Current machine's hostname
        const currentHostname = os.hostname()

        // Before all tests in this block, backup process.env
        before(() => {
            originalEnv = process.env
        })

        // After all tests, restore process.env
        after(() => {
            process.env = originalEnv
        })

        it('Configuration object', function() {
            // Parameter config not present
            assert.throws(() => {
                new SMConfig()
            }, /must be set/i)

            // Parameter config not a string neither an object
            assert.throws(() => {
                new SMConfig(12)
            }, /parameter config must be a string, an array of strings or a plain object/i)

            // Missing config.default
            assert.throws(() => {
                new SMConfig({a: 1})
            }, /cannot find default environment/i)

            // config.default is not an object
            assert.throws(() => {
                new SMConfig({default: 1})
            }, /cannot find default environment/i)

            // All ok
            const config = new SMConfig({default: {}})
            assert.ok(config)
        })

        it('Options parameter', function() {
            // Options parameter is not a dictionary
            assert.throws(() => {
                new SMConfig({default: {}}, 'default', 'invalid')
            })
        })

        it('Environment: fallback to default', function() {
            // Remove process.env.NODE_ENV if present
            delete process.env.NODE_ENV

            // Test fallback to the "default" environment
            const config = new SMConfig(params)
            assert.equal(config.environment, 'default', 'Fallback to \'default\'')
        })

        it('Environment: from hostname (using RegExp)', function() {
            // Require current machine's hostname to be at least 5 chars
            if (!currentHostname || currentHostname.length < 5) {
                this.skip()
                return
            }

            // Escape function source: http://stackoverflow.com/a/4371855/192024
            const currentHostnameRegExp = new RegExp(currentHostname.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'))
            params.hostnames.hostenv = [
                /--notfound/,
                currentHostnameRegExp
            ]
            const config = new SMConfig(params)
            assert.equal(config.environment, 'hostenv')
        })

        it('Environment: from hostname (exact string match)', function() {
            // Require current machine's hostname to be at least 5 chars
            if (!currentHostname || currentHostname.length < 5) {
                this.skip()
                return
            }

            params.hostnames.hostenv = [
                '--notfound',
                currentHostname
            ]
            const config = new SMConfig(params)
            assert.equal(config.environment, 'hostenv')
        })

        it('Environment: from hostname (string with *)', function() {
            // Require current machine's hostname to be at least 5 chars
            if (!currentHostname || currentHostname.length < 5) {
                this.skip()
                return
            }

            params.hostnames.hostenv = [
                '--notfound',
                currentHostname.slice(0, -1) + '*'
            ]
            const config = new SMConfig(params)
            assert.equal(config.environment, 'hostenv')
        })

        it('Environment: use NODE_ENV environmental variable', function() {
            // Note: in this test, process.hostname.hostenv should still be set
            // and it should be overridden

            // Set NODE_ENV environmental variable
            process.env.NODE_ENV = 'envvar'

            const config = new SMConfig(params)
            assert.equal(config.environment, 'envvar')

            // Cleanup
            delete process.env.NODE_ENV
        })

        it('Environment: passing environment to constructor', function() {
            // Note: in this test, process.hostname.hostenv and NODE_ENV are still set,
            // but should both be overridden

            const config = new SMConfig(params, 'passedenv')
            assert.equal(config.environment, 'passedenv')
        })

        it('Configuration: load default configuration', function() {
            const config = new SMConfig(params, 'nonexisting')
            assert.deepStrictEqual(config.all, defaultExpect)
        })

        it('Configuration: do not flatten configuration', function() {
            const config = new SMConfig(params, 'nonexisting', {flatten: false})
            assert.deepStrictEqual(config.all, params.default)
        })

        it('Configuration: load configuration for specific environment', function() {
            let config

            config = new SMConfig(params, 'testenv1')
            assert.deepStrictEqual(config.all, testenv1Expect)

            process.env.NODE_ENV = 'testenv2'
            config = new SMConfig(params)
            assert.deepStrictEqual(config.all, testenv2Expect)

            delete process.env.NODE_ENV
        })

        it('Configuration: overwrite at runtime with environmental variables', function() {
            const envParams = [
                'when=runtime', // New
                'first=overwrite', // Overwrite
                'intNum=-8' // Int
            ]
            process.env.SMCONFIG = envParams.join(' ')

            const expect = SMHelper.cloneObject(testenv2Expect)
            expect.when = 'runtime'
            expect.first = 'overwrite'
            expect.intNum = -8

            const config = new SMConfig(params, 'testenv2')
            assert.deepStrictEqual(config.all, expect)

            // Cleanup
            delete process.env.SMCONFIG
        })

        it('Configuration: overwrite at runtime with environmental variables (nested)', function() {
            const envParams = [
                'obj.z=New', // New
                'obj.x=overwrite', // Overwrite
                'obj.intNum=-8' // Int
            ]
            process.env.SMCONFIG = envParams.join(' ')

            const expect = SMHelper.cloneObject(testenv2Expect)
            expect.obj.z = 'New'
            expect.obj.x = 'overwrite'
            expect.obj.intNum = -8
            expect['obj.z'] = 'New'
            expect['obj.x'] = 'overwrite'
            expect['obj.intNum'] = -8

            const config = new SMConfig(params, 'testenv2')
            assert.deepStrictEqual(config.all, expect)

            // Cleanup
            delete process.env.SMCONFIG
        })

        it('Configuration: overwrite at runtime with multiple environmental variables', function() {
            const envParams1 = [
                'obj.z=New', // New
                'obj.x=overwrite', // Overwrite
                'obj.intNum=-8' // Int
            ]
            const envParams2 = [
                'fruit=pear'
            ]
            process.env.SMCONFIG = envParams1.join(' ')
            process.env.SMCONFIG_1 = envParams2.join(' ')

            const expect = SMHelper.cloneObject(testenv2Expect)
            expect.obj.z = 'New'
            expect.obj.x = 'overwrite'
            expect.obj.intNum = -8
            expect.fruit = 'pear'
            expect['obj.z'] = 'New'
            expect['obj.x'] = 'overwrite'
            expect['obj.intNum'] = -8

            const config = new SMConfig(params, 'testenv2')
            assert.deepStrictEqual(config.all, expect)

            // Cleanup
            delete process.env.SMCONFIG
            delete process.env.SMCONFIG_1
        })

        it('Configuration: overwrite at runtime with environmental variables (custom var name)', function() {
            const envParams = [
                'when=runtime-again', // New
                'foo=overwrite-2', // Overwrite
                'someFloat=19.91' // Number
            ]
            process.env.CONF = envParams.join(' ')

            const expect = SMHelper.cloneObject(defaultExpect)
            expect.when = 'runtime-again'
            expect.foo = 'overwrite-2'
            expect.someFloat = 19.91

            const config = new SMConfig(params, 'default', {envVarName: 'CONF'})
            assert.deepStrictEqual(config.all, expect)

            // Cleanup
            delete process.env.CONF
        })

        it('Configuration: env var file', function() {
            process.env.SMCONFIG_FILE = 'test/resources/env'

            const expect = SMHelper.cloneObject(defaultExpect)
            expect.fruit = 'cherry'
            expect.cake = 0.33
            expect.quote = 'la nebbia agl\'irti colli piovigginando sale'
            expect.obj.z = 'foo'
            expect['obj.z'] = 'foo'

            const config = new SMConfig(params, 'default')
            assert.deepStrictEqual(config.all, expect)

            // Cleanup
            delete process.env.SMCONFIG_FILE
        })
        
        it('Configuration: env var file does not exist', function() {
            process.env.SMCONFIG_FILE = 'test/_notfound'

            assert.throws(() => {
                new SMConfig(params, 'default')
            }, /file doesn't exist/i)

            // Cleanup
            delete process.env.SMCONFIG_FILE
        })

        it('Configuration: env var file is empty', function() {
            process.env.SMCONFIG_FILE = 'test/resources/empty'

            assert.throws(() => {
                new SMConfig(params, 'default')
            }, /file is empty/i)

            // Cleanup
            delete process.env.SMCONFIG_FILE
        })

        it('Configuration: env var file is malformed', function() {
            process.env.SMCONFIG_FILE = 'test/resources/invalid-format.txt'

            assert.throws(() => {
                new SMConfig(params, 'default')
            }, /malformed/i)

            // Cleanup
            delete process.env.SMCONFIG_FILE
        })
        
        it('Configuration: overwrite at runtime with environmental variables (invalid var name)', function() {
            assert.throws(() => {
                new SMConfig(params, 'default', {envVarName: ''})
            }, /empty/)
        })

        it('Configuration: file does not exist', function() {
            assert.throws(() => {
                new SMConfig('test/not-found.json')
            }, /exist|found/)
        })

        it('Configuration: unrecognized format', function() {
            assert.throws(() => {
                new SMConfig('test/resources/invalid-format.txt')
            }, /file format/)
        })

        it('Configuration: load from JSON file', function() {
            // Use another env var name so the env vars set before are ignored
            const config = new SMConfig('test/resources/testconfig.json', 'testenv2', {envVarName: 'NOTHINGHERE'})
            assert.deepStrictEqual(config.all, testenv2Expect)
        })

        it('Configuration: load from YAML file', function() {
            // Use another env var name so the env vars set before are ignored
            const config = new SMConfig('test/resources/testconfig.yaml', 'testenv2', {envVarName: 'NOTHINGHERE'})
            assert.deepStrictEqual(config.all, testenv2Expect)
        })

        it('Configuration: load from Hjson file', function() {
            // Use another env var name so the env vars set before are ignored
            const config = new SMConfig('test/resources/testconfig.hjson', 'testenv2', {envVarName: 'NOTHINGHERE'})
            assert.deepStrictEqual(config.all, testenv2Expect)
        })

        it('Configuration: load multiple files', function() {
            // Use another env var name so the env vars set before are ignored
            const config = new SMConfig(['test/resources/testconfig.json', 'test/resources/addendum.json'], 'default', {envVarName: 'NOTHINGHERE'})
            assert.deepStrictEqual(config.all, addendumExpect)
        })

        it('Configuration: load multiple files, including a new env', function() {
            const expect = SMHelper.cloneObject(addendumExpect)
            expect.fruit = 'apricot'

            // Use another env var name so the env vars set before are ignored
            const config = new SMConfig(['test/resources/testconfig.json', 'test/resources/addendum.json'], 'addendum', {envVarName: 'NOTHINGHERE'})
            assert.deepStrictEqual(config.all, expect)
        })

        it('Configuration: load multiple files, with an invalid filename', function() {
            assert.throws(() => {
                new SMConfig(['test/resources/testconfig.json', 42])
            }, /parameter config must be a string, an array of strings or a plain object/i)
        })
    })

    describe('Object methods', function() {

        it('SMConfig.environment should return environment name', function() {
            const config = new SMConfig({default: {}}, 'myenv')
            assert.strictEqual(config.environment, 'myenv')
        })

        it('SMConfig.environment should be read-only', function() {
            const config = new SMConfig({default: {}}, 'myenv')
            assert.throws(() => {
                config.environment = 'newenv'
            }, /TypeError/)
        })

        it('SMConfig.all should return all configuration options', function() {
            // Use another env var name so the env vars set before are ignored
            const config = new SMConfig({default: {a: 1}, myenv: {b: 2}}, 'myenv', {envVarName: 'NOTHINGHERE'})
            assert.deepStrictEqual(config.all, {a: 1, b: 2})
        })

        it('SMConfig.all should be read-only', function() {
            const config = new SMConfig({default: {}}, 'myenv')
            assert.throws(() => {
                config.all = {hello: 'world'}
            }, /TypeError/)
        })

        it('SMConfig.all should return a cloned object', function() {
            const config = new SMConfig({default: {a: 1, obj: {x: 1, y: 2}}, myenv: {b: 2}}, 'myenv', {envVarName: 'NOTHINGHERE', flatten: false})

            // The returned object should be a clone, so editing a value in it shouldn't change the value in the SMConfig instance
            const all = config.all
            assert.deepStrictEqual(all, {a: 1, b: 2, obj: {x: 1, y: 2}})
            all.a = -10
            all.obj.x = -20
            assert.deepStrictEqual(all, {a: -10, b: 2, obj: {x: -20, y: 2}})
            assert.deepStrictEqual(config.all, {a: 1, b: 2, obj: {x: 1, y: 2}})
        })

        it('SMConfig.get should return value for configuration key', function() {
            // Use another prefix for env vars so the ones set before are ignored
            const config = new SMConfig({default: {a: 1}, myenv: {b: 'ale', foo: ['bar']}}, 'myenv', {envVarPrefix: 'NOTHING_'})
            assert.deepStrictEqual(config.get('a'), 1)
            assert.deepStrictEqual(config.get('b'), 'ale')
            assert.deepStrictEqual(config.get('foo'), ['bar'])

            // Passing a key that is not a string should throw an exception
            assert.throws(() => {
                config.get(12)
            }, /non-empty string/i)
        })

        it('SMConfig.get should return a cloned object', function() {
            // Use another prefix for env vars so the ones set before are ignored
            const config = new SMConfig({default: {a: 1}, myenv: {b: 'ale', foo: ['bar'],  obj: {x: 1, y: 2}}}, 'myenv', {envVarPrefix: 'NOTHING_', flatten: false})
            const obj = config.get('obj')
            assert.deepStrictEqual(obj,  {x: 1, y: 2})
            obj.x = -10
            assert.deepStrictEqual(obj,  {x: -10, y: 2})
            assert.deepStrictEqual(config.get('obj'),  {x: 1, y: 2})
        })
    })
    
})
