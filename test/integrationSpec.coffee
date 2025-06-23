assert = require('assert')
fhir = require('../src/fhir')
integration = require('../src/integration')

describe 'integration', ->
  it "normalize bundle should handle both R4 and DSTU2 formats", ->
    # DSTU2 style bundle
    dstu2Bundle = 
      resourceType: "Bundle"
      entry: [
        {
          fullUrl: "http://example.org/fhir/Patient/123"
          content: {
            resourceType: "Patient"
            id: "123"
            name: [{given: ["John"]}]
          }
        }
      ]
    
    # R4 style bundle  
    r4Bundle = 
      resourceType: "Bundle"
      entry: [
        {
          fullUrl: "http://example.org/fhir/Patient/456"
          resource: {
            resourceType: "Patient"
            id: "456" 
            name: [{given: ["Jane"]}]
          }
        }
      ]
    
    # Normalize both bundles
    normalizedDSTU2 = integration.normalizeBundle(dstu2Bundle)
    normalizedR4 = integration.normalizeBundle(r4Bundle)
    
    # Both should now have both .resource and .content properties
    assert.strictEqual normalizedDSTU2.entry[0].content.id, "123"
    assert.strictEqual normalizedDSTU2.entry[0].resource.id, "123"
    assert.strictEqual normalizedR4.entry[0].content.id, "456" 
    assert.strictEqual normalizedR4.entry[0].resource.id, "456"
    
  it "fetch adapter should convert fetch to adapter", (done) ->
    # Mock fetch implementation
    mockFetch = (url, options) ->
      return Promise.resolve
        ok: true
        headers:
          get: (header) -> if header == 'content-type' then 'application/json' else null
        json: -> Promise.resolve({ resourceType: 'OperationOutcome', status: 'success' })
        text: -> Promise.resolve('success')
    
    # Create adapter from fetch
    adapter = integration.createFetchAdapter(mockFetch)
    
    # Test adapter's http method
    promise = adapter.http
      method: 'GET'
      url: 'http://example.org/fhir/Patient/123'
      
    promise.then (data) ->
      assert.strictEqual data.resourceType, 'OperationOutcome'
      assert.strictEqual data.status, 'success'
      done()
      
  it "references middleware should resolve references across different FHIR versions", ->
    refs = require('../src/middlewares/references')
    
    # Test with R4 bundle
    r4Bundle = 
      resourceType: "Bundle"
      entry: [
        {
          fullUrl: "http://example.org/fhir/Patient/123"
          resource: 
            resourceType: "Patient"
            id: "123"
            name: [{given: ["John"]}]
        }
      ]
      
    # Test with DSTU2 bundle  
    dstu2Bundle =
      resourceType: "Bundle"
      entry: [
        {
          fullUrl: "http://example.org/fhir/Patient/456" 
          content:
            resourceType: "Patient"
            id: "456"
            name: [{given: ["Jane"]}]
        }
      ]
      
    # Test resolving with R4 bundle
    resolvedR4 = refs.sync
      baseUrl: "http://example.org/fhir"
      reference: { reference: "Patient/123" }
      bundle: r4Bundle
      
    # Test resolving with DSTU2 bundle  
    resolvedDSTU2 = refs.sync
      baseUrl: "http://example.org/fhir"
      reference: { reference: "Patient/456" }
      bundle: dstu2Bundle
      
    # Both should resolve successfully
    assert resolvedR4, "R4 reference should resolve"
    assert resolvedDSTU2, "DSTU2 reference should resolve"
    assert.strictEqual resolvedR4.content.id, "123"
    assert.strictEqual resolvedDSTU2.content.id, "456"

  it "should seamlessly integrate search and reference resolution", (done) ->
    # Create a mock adapter that simulates a server response
    mockAdapter = 
      defer: require('../src/testUtils').defer
      http: (args) ->
        if args.url == 'BASE/Patient'
          # Return a patient bundle
          return Promise.resolve
            data:
              resourceType: 'Bundle'
              entry: [
                {
                  resource:
                    resourceType: 'Patient'
                    id: '123'
                    name: [{given: ['John']}]
                    managingOrganization: {reference: 'Organization/org1'}
                }
              ]
        else if args.url == 'BASE/Organization/org1'
          # Return the organization when resolved
          return Promise.resolve
            data:
              resourceType: 'Organization'
              id: 'org1'
              name: 'Test Hospital'
        
    # Create a client with our mock adapter
    client = fhir({baseUrl: 'BASE'}, mockAdapter)
    
    # Test searching for patients then resolving the org reference
    client.search({type: 'Patient'})
      .then (bundle) ->
        # First get the patient from the bundle
        patient = bundle.data.entry[0].resource
        
        # Now resolve the organization reference
        client.resolve({reference: patient.managingOrganization})
          .then (org) ->
            assert.strictEqual org.data.resourceType, 'Organization'
            assert.strictEqual org.data.name, 'Test Hospital'
            done()
      .catch (err) ->
        done(err)

  it "should handle multi-resource queries and reference resolution together", (done) ->
    # Create a client with a mock adapter for multi-resource queries
    mockAdapter = 
      defer: require('../src/testUtils').defer
      http: (args) ->
        if args.url.indexOf('_has:Coverage:beneficiary') > -1
          # Return patients with coverage
          return Promise.resolve
            data:
              resourceType: 'Bundle'
              entry: [
                {
                  resource:
                    resourceType: 'Patient'
                    id: 'pt-with-coverage'
                    name: [{given: ['John']}]
                }
              ]

    client = fhir({baseUrl: 'BASE'}, mockAdapter)
    
    # Test a multi-resource query using _has
    client.search
      type: 'Patient'
      query:
        $has:
          Coverage:
            reference: 'beneficiary'
            criteria: 'period=ge2023-01-01'
      .then (result) ->
        assert.strictEqual result.data.entry[0].resource.id, 'pt-with-coverage'
        done()
      .catch (err) ->
        done(err)
        
  it "should work with cache middleware", (done) ->
    # Create a cache middleware
    cacheMiddleware = integration.createCacheMiddleware(ttl: 5000)
    
    # Create a mock adapter that counts calls
    callCount = 0
    mockAdapter = 
      defer: require('../src/testUtils').defer
      http: (args) ->
        callCount++
        return Promise.resolve
          data:
            resourceType: 'Patient'
            id: '123'
            name: [{given: ['John']}]
    
    # Create a wrapper around the adapter to apply caching
    cachedAdapter = 
      defer: mockAdapter.defer
      http: cacheMiddleware(mockAdapter.http)
    
    client = fhir({baseUrl: 'BASE'}, cachedAdapter)
    
    # First call should hit the adapter
    client.read({type: 'Patient', id: '123'})
      .then (result) ->
        assert.strictEqual callCount, 1
        assert.strictEqual result.data.id, '123'
        
        # Second call with same params should use cache
        client.read({type: 'Patient', id: '123'})
          .then (result) ->
            assert.strictEqual callCount, 1  # Still 1, not incremented
            assert.strictEqual result.data.id, '123'
            done()
      .catch (err) ->
        done(err)

  it "should handle errors consistently across adapters", (done) ->
    # Create a mock adapter that returns an error
    mockAdapter = 
      defer: require('../src/testUtils').defer
      http: (args) ->
        return Promise.reject
          status: 404
          error: 'Not Found'
    
    client = fhir({baseUrl: 'BASE'}, mockAdapter)
    
    # Test error handling
    client.read({type: 'Patient', id: 'nonexistent'})
      .then (result) ->
        done(new Error('Should have failed'))
      .catch (err) ->
        assert.strictEqual err.status, 404
        done()

  it "should expose searchWithReferences as a client method", (done) ->
    # Create a mock adapter
    mockAdapter = 
      defer: require('../src/testUtils').defer
      http: (args) ->
        if args.url.indexOf('Patient') > -1
          return Promise.resolve
            data:
              resourceType: 'Bundle'
              entry: [
                {
                  resource:
                    resourceType: 'Patient'
                    id: '123'
                    managingOrganization: {reference: 'Organization/org1'}
                }
              ]
        else if args.url.indexOf('Organization/org1') > -1
          return Promise.resolve
            data:
              resourceType: 'Organization'
              id: 'org1'
              name: 'Test Hospital'
    
    # Create the client
    client = fhir({baseUrl: 'BASE'}, mockAdapter)
    
    # Test that the client has the searchWithReferences method
    assert.strictEqual typeof client.searchWithReferences, 'function'
    
    # Use the method directly on the client
    client.searchWithReferences(
      {
        type: 'Patient'
      },
      ['Patient.managingOrganization']
    )
    .then (results) ->
      assert.strictEqual results.data.entry[0].resource.id, '123'
      assert.strictEqual results.resolvedReferences['Organization/org1'].name, 'Test Hospital'
      done()
    .catch (err) ->
      done(err)
