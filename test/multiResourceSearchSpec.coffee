fhir = require('../src/fhir')
assert = require('assert')
integration = require('../src/integration')

describe "Multi-resource search:", ->
  cfg = {baseUrl: 'BASE'}
  adapter = {defer: require('../src/testUtils').defer}
  subject = fhir(cfg, adapter)

  it "should support filtering patients by gender, DOB and coverage period", (done)->
    http = (q)->
      assert.equal(q.url, 'BASE/Patient?gender=male&birthdate=ge2000-01-01&_has:Coverage:beneficiary:period=ge2023-01-01')
      done()

    # Test searching for male patients born after 2000 with coverage after 2023
    subject.search
      http: http
      type: 'Patient'
      query:
        gender: 'male'
        birthdate: {$ge: '2000-01-01'}
        $has:
          Coverage:
            reference: 'beneficiary'
            criteria: 'period=ge2023-01-01'
            
  it "should support multiple _has parameters for the same resource", (done)->
    http = (q)->
      assert.equal(q.url, 'BASE/Patient?_has:Coverage:beneficiary:period=ge2023-01-01&_has:Coverage:beneficiary:type=medical')
      done()
      
    subject.search
      http: http
      type: 'Patient'
      query:
        $has:
          Coverage:
            reference: 'beneficiary'
            criteria: 'period=ge2023-01-01&type=medical'
            
  it "should support _has parameters with complex nested criteria", (done)->
    http = (q)->
      assert.equal(q.url, 'BASE/Patient?_has:Observation:subject:code=http://loinc.org|8480-6&_has:Observation:subject:value-quantity=gt120')
      done()
      
    subject.search
      http: http
      type: 'Patient'
      query:
        $has:
          "Observation.subject":
            code: 'http://loinc.org|8480-6'
            "value-quantity": 'gt120'
            
  it "should combine _has, _include and standard search parameters", (done)->
    http = (q)->
      # Check that URL has all parameters correctly
      url = q.url
      assert.notEqual(url.indexOf('BASE/Patient?'), -1)
      assert.notEqual(url.indexOf('gender=female'), -1)
      assert.notEqual(url.indexOf('_has:Coverage:beneficiary:period=ge2023-01-01'), -1)
      assert.notEqual(url.indexOf('_include=Patient:organization'), -1)
      done()
      
    subject.search
      http: http
      type: 'Patient'
      query:
        gender: 'female'
        $has:
          Coverage:
            reference: 'beneficiary'
            criteria: 'period=ge2023-01-01'
        $include:
          Patient: 'organization'
          
  it "should support _has with array of criteria", (done)->
    http = (q)->
      url = q.url
      # Should contain both _has parameters
      assert.notEqual(url.indexOf('_has:Encounter:subject:type=inpatient'), -1)
      assert.notEqual(url.indexOf('_has:Encounter:subject:date=ge2023-01-01'), -1)
      done()
      
    subject.search
      http: http
      type: 'Patient'
      query:
        $has:
          "Encounter.subject": [
            { type: 'inpatient' },
            { date: 'ge2023-01-01' }
          ]
          
  it "should work with integration.searchWithReferences", (done)->
    # Mock client that returns a search result then resolves a reference
    mockClient = 
      search: (params) ->
        promise = Promise.resolve
          data:
            resourceType: 'Bundle'
            entry: [
              {
                resource:
                  resourceType: 'Patient'
                  id: '123'
                  managingOrganization: 
                    reference: 'Organization/org1'
              }
            ]
        promise.then = (fn) -> Promise.resolve(promise).then(fn)
        return promise
      
      resolve: (params) ->
        if params.reference.reference == 'Organization/org1'
          promise = Promise.resolve
            data:
              resourceType: 'Organization'
              id: 'org1'
              name: 'Test Hospital'
          promise.then = (fn) -> Promise.resolve(promise).then(fn)
          return promise
      
      _adapter:
        defer: require('../src/testUtils').defer
        
    # Test the integration helper
    searchParams = 
      type: 'Patient'
      query:
        $has:
          Coverage:
            reference: 'beneficiary'
            criteria: 'period=ge2023-01-01'
            
    resolveParams = ['Patient.managingOrganization']
    
    promise = integration.searchWithReferences(mockClient, searchParams, resolveParams)
    promise.then (results) ->
      # Check that we got both search results and resolved references
      assert.strictEqual results.data.entry[0].resource.id, '123'
      assert.strictEqual results.resolvedReferences['Organization/org1'].name, 'Test Hospital'
      done()
    .catch (err) ->
      done(err)
