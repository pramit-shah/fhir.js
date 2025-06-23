fhir = require('../src/middlewares/search')
assert = require('assert')

describe "linearizeParams:", ->
  subject = fhir._query

  it "simplest", ->
    assert.deepEqual(subject(a:1,b:2) , [{param: 'a', value: [1]},{param: 'b',value: [2]}])

  it "modifier", ->
    assert.deepEqual(subject(a: {$exact: 2}) , [{param: 'a', modifier: ':exact', value: [2]}])

  it "operator", ->
    assert.deepEqual(subject(a: {$lt: 2}) , [{param: 'a', operator: 'lt', value: [2]}])

  it "and", ->
    assert.deepEqual(subject(a: {$and: [1, 2]}) , [{param: 'a', value: [1]}, {param: 'a',value: [2]}])

  it "compound", ->
    assert.deepEqual(subject(a: [1, 2]) , [{param: 'a', value: ['1|2']}])

  it "or", ->
    assert.deepEqual(subject(a: {$or: [1, 2]}) , [{param: 'a', value: [1,2]}])

  it "operator & or", ->
    assert.deepEqual(subject(a: {$exact: {$or: [1,2]}}) , [{param: 'a', modifier: ':exact', value: [1,2]}])

  it "chained params", ->
    assert.deepEqual(subject(subject: {name: {$exact: 'abu'}, birthDate: {$gt: '2000'}}), [
        {param: 'subject.name', modifier: ':exact', value: ['abu']}
        {param: 'subject.birthDate', operator: 'gt', value: ['2000']}
      ])

describe "test params builder", ->
  subject = fhir.query

  it "simple cases", ->
    assert.deepEqual(subject(name: 'buka'), 'name=buka')

    assert.deepEqual(subject(name: {$exact: 'buka'}), 'name:exact=buka')

    assert.deepEqual(subject(birthDate: {$gt: '2011'}), 'birthDate=gt2011')

    assert.deepEqual(subject(birthDate: {$gt: '2011', $lt: '2014'}), 'birthDate=gt2011&birthDate=lt2014')


    assert.deepEqual(subject('subject.name': {$exact: 'maud'}), 'subject.name:exact=maud')

    assert.deepEqual(subject(subject: {$type: 'Patient', name: 'maud',
    birthDate: {$gt: '1970'}}), 'subject:Patient.name=maud&subject:Patient.birthDate=gt1970')

    assert.deepEqual(subject('uri': 'http://test'), 'uri=http%3A%2F%2Ftest')

  it "sort", ->
    assert.deepEqual(subject(
      $sort: [['name','asc'],['birthDate','desc'], 'vip']),
      '_sort:asc=name&_sort:desc=birthDate&_sort=vip')

    assert.deepEqual(
      subject(subject: "id", questionnaire: "Allergies", _count: 1, $sort: [["authored", "desc"]]),
      'subject=id&questionnaire=Allergies&_count=1&_sort:desc=authored')


  it "include", ->
    assert.deepEqual(subject($include: {Observation: "related.component", Patient: ["link.other", "careProvider"]}),
      '_include=Observation:related.component&_include=Patient:link.other&_include=Patient:careProvider')

  it "revinclude", ->
    assert.deepEqual(subject($revInclude: {Observation: "related.component", Patient: ["link.other", "careProvider"]}),
      '_revinclude=Observation:related.component&_revinclude=Patient:link.other&_revinclude=Patient:careProvider')

  it "or", ->
    assert.deepEqual(subject(name: {$or: ['bill', 'ted']}),
      'name=bill%2Cted')

  it "has", ->
    assert.deepEqual(subject($has: {"Observation:patient:code": "1234-5"}),
      '_has:Observation:patient:code=1234-5')

  it "has params with Coverage-Patient relationship", ->
    assert.deepEqual(subject(
      _has: {
        Coverage: {
          beneficiary: {
            gender: 'male',
            birthDate: {$ge: '1970-01-01'}
          },
          period: {
            $ge: '2023-01-01',
            $le: '2023-12-31'
          }
        }
      }), 
      '_has:Coverage:beneficiary:gender=male&_has:Coverage:beneficiary:birthdate=ge1970-01-01&_has:Coverage:period=ge2023-01-01&_has:Coverage:period=le2023-12-31')

  it "should support pagination with resource filtering", ->
    assert.deepEqual(subject({
      _count: 10,
      _page: 2,
      gender: 'male',
      _has: {
        Coverage: {
          beneficiary: 'Patient',
          period: {$ge: '2023-01-01'}
        }
      }
    }),
    '_count=10&_page=2&gender=male&_has:Coverage:beneficiary:period=ge2023-01-01')

  it "should support sorting with resource filtering", ->
    assert.deepEqual(subject({
      _sort: ['-birthDate', 'name'],
      gender: 'male',
      _has: {
        Coverage: {
          beneficiary: 'Patient'
        }
      }
    }),
    '_sort=-birthDate,name&gender=male&_has:Coverage:beneficiary')

  it "should handle null and empty values appropriately", ->
    assert.deepEqual(subject({
      gender: null,
      _has: {
        Coverage: {
          beneficiary: 'Patient',
          period: {$ge: null}
        }
      }
    }),
    '_has:Coverage:beneficiary')

  it "should support combined resource filtering with multiple criteria", ->
    assert.deepEqual(subject({
      resourceType: 'Patient',
      gender: 'male',
      birthDate: {$ge: '1970-01-01'},
      _has: {
        Coverage: {
          beneficiary: 'Patient',
          period: {$ge: '2023-01-01', $le: '2023-12-31'},
          type: {$exact: 'medical'}
        }
      },
      _include: {
        Coverage: 'beneficiary'
      }
    }), 
    'resourceType=Patient&gender=male&birthdate=ge1970-01-01&_has:Coverage:beneficiary:period=ge2023-01-01&_has:Coverage:beneficiary:period=le2023-12-31&_has:Coverage:beneficiary:type:exact=medical&_include=Coverage:beneficiary')

  it "should handle invalid date formats gracefully", ->
    assert.throws(-> subject(
      period: {$ge: 'invalid-date'}), 
      /Invalid date format/)

  it "should validate required fields", ->
    assert.throws(-> subject(
      _has: {Coverage: {}}),
      /Missing required reference/)

  it "should validate query parameters", ->
    assert.throws(-> subject({
      _invalid: 'parameter',
      _has: {
        Coverage: {
          beneficiary: 'Patient'
        }
      }
    }), 
    /Invalid parameter: _invalid/)

  it "should handle multiple invalid parameters", ->
    assert.throws(-> subject({
      _invalid: 'foo',
      _bad: 'bar',
      gender: 'male',
      _has: {Coverage: {beneficiary: 'Patient'}}
    }), /Invalid parameter/)

  it "should handle missing _has resource reference", ->
    assert.throws(-> subject({
      _has: {Coverage: {period: {$ge: '2023-01-01'}}}
    }), /Missing required reference/)

  it "should handle empty query object", ->
    assert.deepEqual(subject({}), '')

  it "should handle null query object", ->
    assert.deepEqual(subject(null), '')

  it "should handle array values in _has", ->
    assert.deepEqual(subject({
      _has: {Coverage: {beneficiary: ['Patient', 'RelatedPerson']}}
    }), '_has:Coverage:beneficiary=Patient%2CRelatedPerson')

  it "should handle deeply nested _has parameters", ->
    assert.deepEqual(subject({
      _has: {Coverage: {beneficiary: {gender: 'male', _has: {Claim: {patient: {active: true}}}}}}
    }), '_has:Coverage:beneficiary:gender=male&_has:Coverage:beneficiary:_has:Claim:patient:active=true')

  it "should handle special characters in parameter values", ->
    assert.deepEqual(subject({name: 'O\'Reilly & Sons'}), 'name=O%27Reilly%20%26%20Sons')
    assert.deepEqual(subject({city: 'München'}), 'city=M%C3%BCnchen')

  it "should handle deeply nested objects in _has", ->
    assert.deepEqual(subject({
      _has: {Coverage: {beneficiary: {address: {city: 'Boston', state: 'MA'}}}}
    }), '_has:Coverage:beneficiary:address.city=Boston&_has:Coverage:beneficiary:address.state=MA')

  it "should handle empty arrays in parameter values", ->
    assert.deepEqual(subject({tags: []}), 'tags=')
    assert.deepEqual(subject({_has: {Coverage: {beneficiary: []}}}), '_has:Coverage:beneficiary=')

  it "should handle boolean values", ->
    assert.deepEqual(subject({active: true}), 'active=true')
    assert.deepEqual(subject({active: false}), 'active=false')

  it "should handle numeric values", ->
    assert.deepEqual(subject({age: 42}), 'age=42')
    assert.deepEqual(subject({height: 1.75}), 'height=1.75')

  it "should handle multiple levels of _has nesting", ->
    assert.deepEqual(subject({
      _has: {Coverage: {beneficiary: {gender: 'male', _has: {Claim: {patient: {active: true, _has: {ExplanationOfBenefit: {claim: {status: 'active'}}}}}}}}}
    }), '_has:Coverage:beneficiary:gender=male&_has:Coverage:beneficiary:_has:Claim:patient:active=true&_has:Coverage:beneficiary:_has:Claim:patient:_has:ExplanationOfBenefit:claim:status=active')

  it "should handle undefined values", ->
    assert.deepEqual(subject({name: undefined}), 'name=')
    assert.deepEqual(subject({_has: {Coverage: {beneficiary: undefined}}}), '_has:Coverage:beneficiary=')

  it "should handle null inside arrays", ->
    assert.deepEqual(subject({tags: [null, 'foo']}), 'tags=foo')
    assert.deepEqual(subject({_has: {Coverage: {beneficiary: [null, 'Patient']}}}), '_has:Coverage:beneficiary=Patient')

  it "should handle empty string values", ->
    assert.deepEqual(subject({name: ''}), 'name=')
    assert.deepEqual(subject({_has: {Coverage: {beneficiary: ''}}}), '_has:Coverage:beneficiary=')

  it "should handle objects with only null/undefined/empty", ->
    assert.deepEqual(subject({foo: null, bar: undefined, baz: ''}), 'foo=&bar=&baz=')

  it "should handle special FHIR search modifiers", ->
    assert.deepEqual(subject({name: {$exact: 'bob', $missing: true}}), 'name:exact=bob&name:missing=true')

  it "should handle $text modifier", ->
    assert.deepEqual(subject({description: {$text: 'diabetes'}}), 'description:text=diabetes')

  it "should handle $asc and $desc sort modifiers", ->
    assert.deepEqual(subject({$sort: [['name', 'asc'], ['birthDate', 'desc']]}), '_sort:asc=name&_sort:desc=birthDate')

  it "should handle very large arrays in parameter values", ->
    arr = Array(1000).fill('foo')
    expected = 'tags=' + encodeURIComponent(arr.join(','))
    assert.deepEqual(subject({tags: arr}), expected)

  it "should handle conflicting parameters (same key, different values)", ->
    # Depending on implementation, this may join or override; test for join
    assert.deepEqual(subject({foo: ['bar', 'baz']}), 'foo=bar%2Cbaz')

  it "should handle reserved FHIR parameters", ->
    assert.deepEqual(subject({_id: '123', _lastUpdated: {$ge: '2020-01-01'}}), '_id=123&_lastUpdated=ge2020-01-01')

  it "should handle unknown/custom modifiers", ->
    assert.deepEqual(subject({foo: {$custom: 'bar'}}), 'foo:custom=bar')

  it "should handle whitespace and unusual unicode in values", ->
    assert.deepEqual(subject({note: '  spaced  '}), 'note=%20%20spaced%20%20')
    assert.deepEqual(subject({emoji: '😀'}), 'emoji=%F0%9F%98%80')

  it "should handle combining _has, _include, and _revinclude", ->
    assert.deepEqual(subject({
      _has: {Coverage: {beneficiary: 'Patient'}},
      $include: {Patient: 'organization'},
      $revInclude: {Observation: 'subject'}
    }), '_has:Coverage:beneficiary=Patient&_include=Patient:organization&_revinclude=Observation:subject')

  it "should handle parameter order preservation", ->
    # Order may not matter for FHIR, but test for deterministic output
    assert.deepEqual(subject({a: 1, b: 2, c: 3}), 'a=1&b=2&c=3')
