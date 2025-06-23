// Simple test for improved multi-resource query
const fhir = require('../src/fhir');

// Create a mock adapter
const adapter = {
  defer: function() {
    const deferred = {};
    deferred.promise = new Promise((resolve, reject) => {
      deferred.resolve = resolve;
      deferred.reject = reject;
    });
    return deferred;
  },
  http: function(args) {
    console.log('Mock adapter received request:', args.url);
    
    // Mock the expected response format
    return Promise.resolve({
      data: {
        resourceType: 'Bundle',
        entry: [{
          resource: {
            resourceType: 'Patient',
            id: '123',
            gender: 'male',
            name: [{ given: ['Test'], family: ['Patient'] }]
          }
        }]
      }
    });
  }
};

// Create a FHIR client with the mock adapter
const client = fhir({ baseUrl: 'http://example.org/fhir' }, adapter);

// Test multi-resource search with _has parameter
function testSearch() {
  console.log('Testing multi-resource search with _has parameter...');
  
  return client.search({
    type: 'Patient',
    query: {
      gender: 'male',
      $has: {
        'Coverage.beneficiary': {
          period: 'ge2023-01-01'
        }
      }
    }
  }).then(result => {
    console.log('Search successful!');
    console.log('Result:', JSON.stringify(result.data, null, 2));
    
    // Return the result
    return result;
  }).catch(error => {
    console.error('Search failed:', error);
    throw error;
  });
}

// Run the test
testSearch();
