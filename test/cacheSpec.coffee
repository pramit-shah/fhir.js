/**
 * Tests for the FHIR.js caching middleware
 */

var test = require('tape');
var nock = require('nock');
var fhir = require('../src/adapters/node');

// Helper function to create a mock FHIR server
function mockFhirServer() {
  return nock('http://example.com')
    .defaultReplyHeaders({
      'Content-Type': 'application/json+fhir'
    });
}

// Test basic caching functionality
test('Cache middleware - basic functionality', function(t) {
  t.plan(8);
  
  // Create mock server
  var server = mockFhirServer();
  
  // First request will be served from server
  server
    .get('/Patient/123')
    .reply(200, {
      resourceType: 'Patient',
      id: '123',
      name: [{ given: ['John'], family: 'Doe' }]
    });
    
  // Create client with caching enabled
  var client = fhir({
    baseUrl: 'http://example.com',
    cache: {
      enabled: true,
      maxSize: 100,
      ttl: 60 * 1000 // 1 minute TTL
    }
  });
  
  // First request - should hit the server
  client.read({ type: 'Patient', id: '123' })
    .then(function(response) {
      t.equal(response.resourceType, 'Patient', 'First request: Got Patient resource');
      t.equal(response.id, '123', 'First request: Got correct Patient ID');
      t.equal(response.name[0].family, 'Doe', 'First request: Got correct Patient name');
      
      // Get cache stats
      var stats = client.getCacheStats();
      t.equal(stats.totalEntries, 1, 'Cache should have 1 entry after first request');
      t.equal(stats.byResourceType.Patient, 1, 'Cache should have 1 Patient after first request');
      
      // Second request - should be served from cache
      return client.read({ type: 'Patient', id: '123' });
    })
    .then(function(response) {
      t.equal(response.resourceType, 'Patient', 'Second request: Got Patient resource');
      t.equal(response.id, '123', 'Second request: Got correct Patient ID');
      t.equal(response.name[0].family, 'Doe', 'Second request: Got correct Patient name');
      
      // Verify the server wasn't hit a second time
      t.ok(server.isDone(), 'Server should only be hit once');
    })
    .catch(function(error) {
      t.fail('Error in test: ' + error);
    })
    .finally(function() {
      nock.cleanAll();
      t.end();
    });
});

// Test cache invalidation on write
test('Cache middleware - invalidation on write', function(t) {
  t.plan(5);
  
  // Create mock server
  var server = mockFhirServer();
  
  // GET response
  server
    .get('/Patient/123')
    .reply(200, {
      resourceType: 'Patient',
      id: '123',
      name: [{ given: ['John'], family: 'Doe' }]
    });
    
  // PUT response
  server
    .put('/Patient/123')
    .reply(200, {
      resourceType: 'Patient',
      id: '123',
      name: [{ given: ['John'], family: 'Smith' }]
    });
    
  // GET after update - client should go back to server
  server
    .get('/Patient/123')
    .reply(200, {
      resourceType: 'Patient',
      id: '123',
      name: [{ given: ['John'], family: 'Smith' }]
    });
  
  // Create client with caching enabled
  var client = fhir({
    baseUrl: 'http://example.com',
    cache: {
      enabled: true,
      maxSize: 100,
      ttl: 60 * 1000 // 1 minute TTL
    }
  });
  
  // First read - caches the resource
  client.read({ type: 'Patient', id: '123' })
    .then(function(patient) {
      t.equal(patient.name[0].family, 'Doe', 'Initial read has correct name');
      
      // Update the resource
      return client.update({ 
        type: 'Patient',
        id: '123',
        resource: {
          resourceType: 'Patient',
          id: '123',
          name: [{ given: ['John'], family: 'Smith' }]
        }
      });
    })
    .then(function(updatedPatient) {
      t.equal(updatedPatient.name[0].family, 'Smith', 'Update returned updated resource');
      
      // Read again - should get latest from server
      return client.read({ type: 'Patient', id: '123' });
    })
    .then(function(reReadPatient) {
      t.equal(reReadPatient.name[0].family, 'Smith', 'Read after update gets latest version');
      
      // Check cache stats
      var stats = client.getCacheStats();
      t.equal(stats.totalEntries, 1, 'Cache should still have 1 entry');
      t.equal(stats.byResourceType.Patient, 1, 'Cache should have 1 Patient');
    })
    .catch(function(error) {
      t.fail('Error in test: ' + error);
    })
    .finally(function() {
      nock.cleanAll();
      t.end();
    });
});

// Test search result caching
test('Cache middleware - search result caching', function(t) {
  t.plan(5);
  
  // Create mock server
  var server = mockFhirServer();
  
  // Search response
  server
    .get('/Patient?name=smith')
    .reply(200, {
      resourceType: 'Bundle',
      type: 'searchset',
      total: 2,
      entry: [
        {
          resource: {
            resourceType: 'Patient',
            id: '123',
            name: [{ given: ['John'], family: 'Smith' }]
          }
        },
        {
          resource: {
            resourceType: 'Patient',
            id: '456',
            name: [{ given: ['Jane'], family: 'Smith' }]
          }
        }
      ]
    });
  
  // Create client with caching enabled
  var client = fhir({
    baseUrl: 'http://example.com',
    cache: {
      enabled: true,
      maxSize: 100,
      ttl: 60 * 1000, // 1 minute TTL
      cacheSearchResults: true
    }
  });
  
  // First search - hits server
  client.search({ type: 'Patient', query: { name: 'smith' } })
    .then(function(results) {
      t.equal(results.total, 2, 'Search should return 2 results');
      t.equal(results.entry.length, 2, 'Search bundle should have 2 entries');
      
      // Check cache stats - should have cached both individual resources AND the search
      var stats = client.getCacheStats();
      t.equal(stats.byResourceType.Patient, 2, 'Cache should contain 2 patients');
      
      // Second search with same params - should be from cache
      return client.search({ type: 'Patient', query: { name: 'smith' } });
    })
    .then(function(results) {
      t.equal(results.total, 2, 'Cached search should return 2 results');
      t.equal(results.entry.length, 2, 'Cached search bundle should have 2 entries');
      
      // Verify the server wasn't hit a second time
      t.ok(server.isDone(), 'Server should only be hit once');
    })
    .catch(function(error) {
      t.fail('Error in test: ' + error);
    })
    .finally(function() {
      nock.cleanAll();
      t.end();
    });
});

// Test cache clearing
test('Cache middleware - cache clearing', function(t) {
  t.plan(4);
  
  // Create mock server
  var server = mockFhirServer();
  
  // First request
  server
    .get('/Patient/123')
    .reply(200, {
      resourceType: 'Patient',
      id: '123',
      name: [{ given: ['John'], family: 'Doe' }]
    });
    
  // After clearing cache, will hit server again
  server
    .get('/Patient/123')
    .reply(200, {
      resourceType: 'Patient',
      id: '123',
      name: [{ given: ['John'], family: 'Doe' }]
    });
  
  // Create client with caching enabled
  var client = fhir({
    baseUrl: 'http://example.com',
    cache: {
      enabled: true,
      maxSize: 100,
      ttl: 60 * 1000 // 1 minute TTL
    }
  });
  
  // First read - caches the resource
  client.read({ type: 'Patient', id: '123' })
    .then(function(patient) {
      t.equal(patient.name[0].family, 'Doe', 'Initial read has correct data');
      
      // Check cache stats
      var stats = client.getCacheStats();
      t.equal(stats.totalEntries, 1, 'Cache should have 1 entry');
      
      // Clear the cache
      client.clearCache();
      
      // Check stats again
      stats = client.getCacheStats();
      t.equal(stats.totalEntries, 0, 'Cache should be empty after clearing');
      
      // Read again - should hit server
      return client.read({ type: 'Patient', id: '123' });
    })
    .then(function(patient) {
      t.equal(patient.name[0].family, 'Doe', 'Re-read after cache clear has correct data');
      
      // Verify the server was hit twice
      t.ok(server.isDone(), 'Server should be hit twice');
    })
    .catch(function(error) {
      t.fail('Error in test: ' + error);
    })
    .finally(function() {
      nock.cleanAll();
      t.end();
    });
});
