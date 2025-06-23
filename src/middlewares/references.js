(function() {
    var utils = require('../utils');

    var CONTAINED = /^#(.*)/;
    var resolveContained = function(ref, resource) {
        var cid = ref.match(CONTAINED)[1];
        var ret = (resource.contained || []).filter(function(r){
            return (r.id || r._id) == cid;
        })[0];
        return (ret && {content: ret}) || null;
    };

    var sync = function(arg) {
        var cache = arg.cache;
        var reference = arg.reference;
        var bundle = arg.bundle;
        var ref = reference;
        
        // Basic validation of reference
        if (!ref || !ref.reference) {return null;}
        
        // Handle contained resources
        if (ref.reference.match(CONTAINED)) {
            return resolveContained(ref.reference, arg.resource);
        }
        
        // Convert to absolute URL for consistent comparison
        var abs = utils.absoluteUrl(arg.baseUrl, ref.reference);
        
        // Extract resource type and id from the reference
        var refParts = ref.reference.split('/');
        var refResourceType = refParts.length > 1 ? refParts[0] : null;
        var refId = refParts.length > 1 ? refParts[1] : refParts[0];
        
        // Enhanced bundle entry detection for both DSTU2 and R4
        if (bundle && bundle.entry && bundle.entry.length) {
            var bundled = bundle.entry.find(function(e) {
                // Case 1: Direct match by fullUrl (preferred, works in both R4 and DSTU2)
                if (e.fullUrl === abs) {
                    return true;
                }
                
                // Case 2: Match by id (DSTU2 style)
                if (e.id === abs) {
                    return true;
                }
                
                // Case 3: R4 style - match by resource.resourceType and resource.id
                if (e.resource && e.resource.resourceType && e.resource.id) {
                    var resourceUrl = utils.absoluteUrl(arg.baseUrl, e.resource.resourceType + "/" + e.resource.id);
                    if (resourceUrl === abs) {
                        return true;
                    }
                    
                    // Also check for partial matches if we extracted type and id
                    if (refResourceType && refId && 
                        e.resource.resourceType === refResourceType && 
                        e.resource.id === refId) {
                        return true;
                    }
                }
                
                // Case 4: DSTU2 style - match by content.resourceType and content.id
                if (e.content && e.content.resourceType && e.content.id) {
                    var contentUrl = utils.absoluteUrl(arg.baseUrl, e.content.resourceType + "/" + e.content.id);
                    if (contentUrl === abs) {
                        return true;
                    }
                    
                    // Also check for partial matches
                    if (refResourceType && refId && 
                        e.content.resourceType === refResourceType && 
                        e.content.id === refId) {
                        return true;
                    }
                }
                
                return false;
            });
            
            // Return the resource in a consistent format
            if (bundled) {
                if (bundled.resource) {
                    return { content: bundled.resource };
                } else if (bundled.content) {
                    return { content: bundled.content };
                } else {
                    // If no resource/content is found but entry is matched, return the entry itself
                    return bundled;
                }
            }
        }
        
        // Check in cache as fallback
        return (cache != null ? cache[abs] : void 0) || null;
    };

    var resolve = function(h){
        return function(args) {
            var cacheMatched = sync(args);
            var ref = args.reference;
            var def = args.defer();
            if (cacheMatched) {
                if(!args.defer){ throw new Error("I need promise constructor 'adapter.defer' in adapter"); }
                def.resolve(cacheMatched);
                return def.promise;
            }
            if (!ref) {
                throw new Error("No reference found");
            }
            if (ref && ref.reference.match(CONTAINED)) {
                throw new Error("Contained resource not found");
            }
            args.url = utils.absoluteUrl(args.baseUrl, ref.reference);
            args.data = null;
            return h(args);
        };
    };

    module.exports.sync = sync;
    module.exports.resolve = resolve;

}).call(this);
