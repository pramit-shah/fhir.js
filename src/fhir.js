(function() {
    var utils = require("./utils");
    var M = require('./middlewares/core');
    var query = require('./middlewares/search');
    var auth = require('./middlewares/auth');
    var transport = require('./middlewares/http');
    var errors = require('./middlewares/errors');
    var config = require('./middlewares/config');
    var bundle = require('./middlewares/bundle');
    var pt = require('./middlewares/patient');
    var refs = require('./middlewares/references');
    var url = require('./middlewares/url');
    var decorate = require('./decorate');

    // Import our enhanced modules
    var errorHandling = require('./error-handling');
    var dependencyManager = require('./dependency-manager');
    var logging = require('./logging');

    var cache = {};
    var integration = require('./integration');

    // Initialize the logger
    var logger = logging.getLogger('fhir:core');

    // Validate adapter configuration
    var validateAdapter = function(adapter) {
        if (!adapter) {
            throw new Error('FHIR.js: No adapter specified');
        }
        
        logger.debug('Validating adapter', { 
            adapter: adapter.name || 'unnamed',
            methods: Object.keys(adapter).filter(function(k) { 
                return typeof adapter[k] === 'function'; 
            })
        });
        
        // Essential adapter methods
        var requiredMethods = ['http', 'defer'];
        var missingMethods = requiredMethods.filter(function(method) {
            return !adapter[method];
        });
        
        if (missingMethods.length) {
            logger.warn('Adapter is missing required methods', { missing: missingMethods });
            throw new Error('FHIR.js: Adapter is missing required methods: ' + missingMethods.join(', '));
        }
        
        // Register the adapter in the dependency manager
        dependencyManager.register('adapter', adapter);
        
        return adapter;
    };        var fhir = function(cfg, adapter){
        // Set up global configuration
        logging.configure({
            level: (cfg && cfg.logging && cfg.logging.level) || 'warn',
            includeTimestamps: true,
            includeComponent: true
        });
        
        logger.info('Initializing FHIR.js client', { config: cfg });
        
        // Validate the adapter before proceeding
        adapter = validateAdapter(adapter);
        
        var Middleware = M.Middleware;
        var $$Attr = M.$$Attr;

        var $$Method = function(m){ return $$Attr('method', m);};
        var $$Header = function(h,v) {return $$Attr('headers.' + h, v);};

        // Enhanced error middleware that uses our error handling system
        var enhancedErrorsMiddleware = function(h) {
            return function(args) {
                var defer = adapter.defer();
                
                h(args).then(function(data) {
                    defer.resolve(data);
                }, function(err) {
                    // Ensure error is properly enriched
                    var enrichedError = errorHandling.enrichError(err, {
                        url: args.url,
                        method: args.method,
                        request: args
                    });
                    
                    // Report the error (unless suppressed)
                    if (!args.suppressErrors) {
                        errorHandling.reportError(enrichedError);
                    }
                    
                    defer.reject(enrichedError);
                });
                
                return defer.promise;
            };
        };
        
        var $Errors = Middleware(enhancedErrorsMiddleware);
        var Defaults = Middleware(config(cfg, adapter))
                .and($Errors)
                .and(auth.$Basic)
                .and(auth.$Bearer)
                .and(auth.$Credentials)
                .and(transport.$JsonData)
                .and($$Header('Accept', (cfg.headers && cfg.headers['Accept']) ? cfg.headers['Accept'] : 'application/json'))
                .and($$Header('Content-Type', (cfg.headers && cfg.headers['Content-Type']) ? cfg.headers['Content-Type'] : 'application/json'));

        var GET = Defaults.and($$Method('GET'));
        var POST = Defaults.and($$Method('POST'));
        var PUT = Defaults.and($$Method('PUT'));
        var DELETE = Defaults.and($$Method('DELETE'));
        var PATCH = Defaults.and($$Method('PATCH'));

        // Use enhanced HTTP if configured, otherwise fall back to standard HTTP
        var useEnhanced = cfg.useEnhancedHttp !== false; // Default to true unless explicitly set to false
        var http = useEnhanced ? transport.EnhancedHttp(cfg, adapter) : transport.Http(cfg, adapter);

        var Path = url.Path;
        var BaseUrl = Path(cfg.baseUrl);
        var resourceTypePath = BaseUrl.slash(":type || :resource.resourceType");
        var searchPath = resourceTypePath;
        var resourceTypeHxPath = resourceTypePath.slash("_history");
        var resourcePath = resourceTypePath.slash(":id || :resource.id");
        var resourceHxPath = resourcePath.slash("_history");
        var vreadPath =  resourcePath.slash(":versionId || :resource.meta.versionId");
        var metaTarget = BaseUrl.slash(":target.resourceType || :target.type").slash(":target.id").slash(':target.versionId');

        var ReturnHeader = $$Header('Prefer', 'return=representation');

        var $Paging = Middleware(query.$Paging);

        return decorate({
            conformance: GET.and(BaseUrl.slash("metadata")).end(http),
            document: POST.and(BaseUrl.slash("Document")).end(http),
            profile:  GET.and(BaseUrl.slash("Profile").slash(":type")).end(http),
            transaction: POST.and(BaseUrl).end(http),
            history: GET.and(BaseUrl.slash("_history")).and($Paging).end(http),
            typeHistory: GET.and(resourceTypeHxPath).and($Paging).end(http),
            resourceHistory: GET.and(resourceHxPath).and($Paging).end(http),
            read: GET.and(pt.$WithPatient).and(resourcePath).end(http),
            vread: GET.and(vreadPath).end(http),
            "delete": DELETE.and(resourcePath).and(ReturnHeader).end(http),
            create: POST.and(resourceTypePath).and(ReturnHeader).end(http),
            validate: POST.and(resourceTypePath.slash("_validate")).end(http),
            meta: {
                add: POST.and(metaTarget.slash("$meta-add")).end(http),
                delete: POST.and(metaTarget.slash("$meta-delete")).end(http),
                read: GET.and(metaTarget.slash("$meta")).end(http)
            },
            search: GET.and(resourceTypePath).and(pt.$WithPatient).and(query.$SearchParams).and($Paging).end(http),
            // Add multi-resource search capability
            multiTypeSearch: GET.and(BaseUrl).and(query.$SearchParams).and($Paging).end(http),
            
            // Add compartment search capability
            compartmentSearch: GET.and(BaseUrl.slash(":compartment").slash(":id").slash(":resourceType")).and(query.$SearchParams).and($Paging).end(http),
            
            // Helper method for chained search
            chainedSearch: function(chainPath, value) {
                return query.chainedSearch(chainPath, value);
            },
            update: PUT.and(resourcePath).and(ReturnHeader).end(http),
            conditionalUpdate: PUT.and(resourceTypePath).and(query.$SearchParams).and(ReturnHeader).end(http),
            conditionalDelete: DELETE.and(resourceTypePath).and(query.$SearchParams).and(ReturnHeader).end(http),
            nextPage: GET.and(bundle.$$BundleLinkUrl("next")).end(http),
            // For previous page, bundle.link.relation can either have 'previous' or 'prev' values
            prevPage: GET.and(bundle.$$BundleLinkUrl("previous")).and(bundle.$$BundleLinkUrl("prev")).end(http),
            getBundleByUrl: GET.and(Path(":url")).end(http),
            resolve: GET.and(refs.resolve).end(http),
            patch: PATCH.and(resourcePath).and($$Header('Content-Type', 'application/json-patch+json')).end(http)
        }, adapter);
    };
    
    // Export integration utilities as well
    fhir.utils = utils;
    fhir.integration = integration;
    
    // Add convenience methods for creating adapters
    fhir.fetchAdapter = function(fetchFn, options) {
        return integration.createFetchAdapter(fetchFn, options);
    };
    
    // Create middleware for response caching
    fhir.cacheMiddleware = integration.createCacheMiddleware;
    
    // Add searchWithReferences as a method on the FHIR client prototype
    var origFhir = fhir;
    fhir = function(config, adapter) {
        var client = origFhir(config, adapter);
        
        // Add enhanced searchWithReferences method to client
        client.searchWithReferences = function(searchParams, resolveParams) {
            // Use the integration helper but with 'this' as the client
            return integration.searchWithReferences(this, searchParams, resolveParams);
        };
        
        // Store adapter for middleware enhancement
        client._adapter = adapter;
        
        // Add error handling capabilities
        client.errors = {
            // Expose error type constants
            types: errorHandling.ErrorTypes,
            
            // Allow registering custom error reporter
            registerErrorReporter: errorHandling.registerErrorReporter,
            
            // Method to manually report an error
            report: errorHandling.reportError,
            
            // Method to check if error is retriable
            isRetriable: function(error) {
                var classification = errorHandling.classifyError(error);
                return classification && classification.retriable;
            },
            
            // Method to retry a failed operation
            retry: function(failedOperation, options) {
                options = options || {};
                var maxRetries = options.maxRetries || 3;
                var initialDelay = options.initialDelay || 1000;
                var factor = options.factor || 2;
                var jitter = options.jitter !== false;
                
                return errorHandling.createRetryPolicy(failedOperation, {
                    maxRetries: maxRetries,
                    baseDelay: initialDelay,
                    exponential: true,
                    factor: factor,
                    jitter: jitter
                });
            }
        };
        
        // Add dependency management
        client.dependencies = {
            // Register a dependency
            register: dependencyManager.register,
            
            // Get a dependency
            get: dependencyManager.get,
            
            // Check for feature
            hasFeature: function(featureName) {
                return dependencyManager.hasFeature(featureName);
            },
            
            // Get all registered features
            getFeatures: dependencyManager.getFeatures
        };
        
        // Add logging capabilities
        client.logging = {
            // Configure logging
            configure: logging.configure,
            
            // Create a logger
            getLogger: logging.getLogger,
            
            // Set global log level
            setLevel: logging.setLevel,
            
            // Log level constants
            levels: logging.LogLevels
        };
        
        return client;
    };
    
    // Copy over properties from original fhir function
    for (var key in origFhir) {
        if (origFhir.hasOwnProperty(key)) {
            fhir[key] = origFhir[key];
        }
    }

    // Export main FHIR client
    module.exports = fhir;
    
    // Also expose our utility systems directly
    module.exports.errorHandling = errorHandling;
    module.exports.dependencyManager = dependencyManager;
    module.exports.logging = logging;
}).call(this);
