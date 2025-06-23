(function() {
  var utils = require('../utils');

  var type = utils.type;

  var assertArray = utils.assertArray;

  var assertObject = utils.assertObject;

  var reduceMap = utils.reduceMap;

  var identity = utils.identity;

  var OPERATORS = {
    $gt: 'gt',
    $lt: 'lt',
    $lte: 'lte',
    $gte: 'gte',
    $ge: 'ge',
    $le: 'le'
  };

  var MODIFIERS = {
    $asc: ':asc',
    $desc: ':desc',
    $exact: ':exact',
    $missing: ':missing',
    $null: ':missing',
    $text: ':text',
    $has: ':has'  // Add support for _has parameter
  };

  // Support for _has parameter to filter on related resources
  var handleHasParameter = function(resource, reference, criteria) {
    return '_has:' + resource + ':' + reference + ':' + criteria;
  };

  var isOperator = function(v) {
    return v.indexOf('$') === 0;
  };

  var expandParam = function(k, v) {
    return reduceMap(v, function(acc, arg) {
      var kk, o, res, vv;
      kk = arg[0], vv = arg[1];
      return acc.concat(kk === '$and' ? assertArray(vv).reduce((function(a, vvv) {
        return a.concat(linearizeOne(k, vvv));
      }), []) : kk === '$type' ? [] : isOperator(kk) ? (o = {
        param: k
      }, kk === '$or' ? o.value = vv : (OPERATORS[kk] ? o.operator = OPERATORS[kk] : void 0, MODIFIERS[kk] ? o.modifier = MODIFIERS[kk] : void 0, type(vv) === 'object' && vv.$or ? o.value = vv.$or : o.value = [vv]), [o]) : (v.$type ? res = ":" + v.$type : void 0, linearizeOne("" + k + (res || '') + "." + kk, vv)));
    });
  };

  var handleSort = function(xs) {
    var i, len, results, x;
    assertArray(xs);
    results = [];
    for (i = 0, len = xs.length; i < len; i++) {
      x = xs[i];
      switch (type(x)) {
      case 'array':
        results.push({
          param: '_sort',
          value: x[0],
          modifier: ":" + x[1]
        });
        break;
      case 'string':
        results.push({
          param: '_sort',
          value: x
        });
        break;
      default:
        results.push(void 0);
      }
    }
    return results;
  };

  var handleInclude = function(includes, key) {
    return reduceMap(includes, function(acc, arg) {
      var k, v;
      k = arg[0], v = arg[1];
      return acc.concat((function() {
        switch (type(v)) {
        case 'array':
          return v.map(function(x) {
            return {
              param: key === '$include' ? '_include' : '_revinclude',
              value: k + ":" + x
            };
          });
        case 'string':
          return [
            {
              param: key === '$include' ? '_include' : '_revinclude',
              value: k + ":" + v
            }
          ];
        }
      })());
    });
  };
  var handleHas = function(includes, key) {
    return reduceMap(includes, function(acc, arg) {
      var k, v;
      k = arg[0], v = arg[1];
      
      // k format should be "sourceResource.searchParameter"
      var parts = k.split('.');
      if (parts.length !== 2) {
        console.warn("_has parameter should use 'sourceResource.searchParameter' format");
      }
      
      return acc.concat((function() {
        switch (type(v)) {
        case 'object':
          // Handle more complex _has queries with nested criteria
          return Object.keys(v).map(function(criteria) {
            return {
              param: '_has',
              value: k + ":" + criteria + "=" + v[criteria]
            };
          });
        case 'array':
          return v.map(function(x) {
            // Support for both simple values and key-value pairs
            if (type(x) === 'object') {
              return Object.keys(x).map(function(criteria) {
                return {
                  param: '_has',
                  value: k + ":" + criteria + "=" + x[criteria]
                };
              });
            } else {
              return {
                param: '_has',
                value: k + "=" + x
              };
            }
          }).flat();
        case 'string':
        case 'number':
        case 'boolean':
          return [
            {
              param: '_has',
              value: k + "=" + v
            }
          ];
        }
      })());
    });
  };
  var linearizeOne = function(k, v) {
    if (k === '$sort') {
      return handleSort(v);
    } else if (k === '$has') {
      return handleHas(v, k);
    } else if (k === '$include' || k === '$revInclude') {
      return handleInclude(v, k);
    } else {
      switch (type(v)) {
      case 'object':
        return expandParam(k, v);
      case 'string':
        return [
          {
            param: k,
            value: [v]
          }
        ];
      case 'number':
        return [
          {
            param: k,
            value: [v]
          }
        ];
      case 'array':
        return [
          {
            param: k,
            value: [v.join("|")]
          }
        ];
      default:
        throw "could not linearizeParams " + (type(v));
      }
    }
  };

  var linearizeParams = function(query) {
    return reduceMap(query, function(acc, arg) {
      var k, v;
      k = arg[0], v = arg[1];
      return acc.concat(linearizeOne(k, v));
    });
  };

  var buildSearchParams = function(query) {
    var p, ps, value;
    // Parameters that should not be URL-encoded because they have special formatting
    var excludeEncode = ['_include', '_revinclude', '_has'];
    
    // Detect if we have any special parameters that require additional handling
    var hasSpecialParams = false;
    if (query.$has || query._has || query.$include || query.$revInclude) {
      hasSpecialParams = true;
    }
    
    ps = (function() {
      var i, len, ref, results;
      ref = linearizeParams(query);
      results = [];
      for (i = 0, len = ref.length; i < len; i++) {
        p = ref[i];
        
        // Handle different parameter types appropriately
        if (excludeEncode.indexOf(p.param) === -1) {
          // Standard parameters are URL-encoded
          if (Array.isArray(p.value)) {
            // For array values, handle each item individually
            value = p.value.map(function(v) {
              return encodeURIComponent(v);
            }).join(',');
          } else {
            value = encodeURIComponent(p.value);
          }
        } else {
          // Special parameters like _has, _include use their own format
          value = p.value;
        }
        
        // Construct the parameter string based on its type
        var separator = (p.param === '_has' || p.param.indexOf('_has:') === 0) ? ':' : '=';
        results.push([p.param, p.modifier, separator, p.operator, value].filter(identity).join(''));
      }
      return results;
    })();
    return ps.join("&");
  };

  // Helper function to build chained search parameters
  var buildChainedSearch = function(chainPath, value) {
    if (!chainPath || !value) return null;
    
    var parts = chainPath.split('.');
    var result = {};
    
    // Handle simple chained search (e.g., "subject.name=value")
    if (parts.length === 2) {
      result[parts[0] + '.' + parts[1]] = value;
      return result;
    }
    
    // Handle complex chained search using _has
    if (parts.length >= 3) {
      var sourceResource = parts[0]; // e.g., "Observation"
      var searchParam = parts[1];    // e.g., "subject"
      var targetParam = parts.slice(2).join('.'); // e.g., "name" or "name.given"
      
      // Create a properly structured _has parameter
      var hasParam = {};
      hasParam['$has'] = {};
      hasParam['$has'][sourceResource + '.' + searchParam] = {};
      hasParam['$has'][sourceResource + '.' + searchParam][targetParam] = value;
      
      return hasParam;
    }
    
    return null;
  };
  
  exports._query = linearizeParams;

  exports.query = buildSearchParams;

  exports.chainedSearch = buildChainedSearch;

  var mw = require('./core');

  exports.$SearchParams = mw.$$Attr('url', function(args){
    var url = args.url;
    if(args.query){
      var queryStr = buildSearchParams(args.query);
      return url + "?" + queryStr;
    }
    return url;
  });


  exports.$Paging = function(h){
    return function(args){
      var params = args.params || {};
      if(args.since){params._since = args.since;}
      if(args.count){params._count = args.count;}
      args.params = params;
      return h(args);
    };
  };


}).call(this);
