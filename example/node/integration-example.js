// Simple example of using the enhanced integration features
const Fhir = require('../../src/adapters/node');

// Create a client with retry configuration
const client = Fhir({
  baseUrl: 'http://hapi.fhir.org/baseR4',
  timeout: 10000,
  retries: 2,
  retryDelay: 1000,
  debug: true
});

console.log("Searching for patients and resolving their organization references...");

// Combined search and reference resolution
client.searchWithReferences(
  // Search parameters
  {
    type: 'Patient',
    query: {
      _count: 3 // Limit to 3 patients
    }
  },
  // References to resolve
  ['Patient.managingOrganization']
)
.then(results => {
  console.log("\nSearch results:");
  
  if (results.data && results.data.entry) {
    console.log(`Found ${results.data.entry.length} patients`);
    
    results.data.entry.forEach(entry => {
      const patient = entry.resource;
      console.log(`\nPatient: ${patient.id}`);
      
      // Check if this patient has a managing organization
      if (patient.managingOrganization && patient.managingOrganization.reference) {
        const orgRef = patient.managingOrganization.reference;
        const org = results.resolvedReferences[orgRef];
        
        if (org) {
          console.log(`  Organization: ${org.name || 'Unknown'}`);
        } else {
          console.log(`  Organization reference ${orgRef} could not be resolved`);
        }
      } else {
        console.log("  No managing organization");
      }
    });
  } else {
    console.log("No patients found");
  }
  
  // Log any errors that occurred during reference resolution
  if (results.errors && results.errors.length > 0) {
    console.log("\nErrors during reference resolution:");
    results.errors.forEach(err => {
      console.log(`  Failed to resolve ${err.reference}: ${err.error.message || 'Unknown error'}`);
    });
  }
})
.catch(error => {
  console.error("Error:", error);
});
