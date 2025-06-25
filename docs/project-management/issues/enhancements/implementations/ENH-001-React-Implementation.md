# ENH-001 Implementation: React Component Wrappers

This document outlines the technical implementation plan for the React components in the FHIR.js React wrapper package.

## Package Structure

```text
fhir-react/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts
│   ├── hooks/
│   │   ├── index.ts
│   │   ├── useFhirContext.ts
│   │   ├── useFhirSearch.ts
│   │   ├── useFhirResource.ts
│   │   ├── useFhirTransaction.ts
│   │   └── useFhirMetadata.ts
│   ├── components/
│   │   ├── index.ts
│   │   └── FhirProvider.tsx
│   ├── types/
│   │   ├── index.ts
│   │   └── react-fhir.d.ts
│   └── utils/
│       ├── index.ts
│       ├── errorHandling.ts
│       └── queryUtils.ts
├── tests/
│   ├── hooks/
│   │   ├── useFhirSearch.test.ts
│   │   └── ...
│   └── components/
│       └── FhirProvider.test.ts
└── examples/
    ├── basic-usage/
    ├── error-handling/
    └── complex-search/
```

## Core Components and Hooks

### FhirProvider Component

```typescript
// src/components/FhirProvider.tsx
import React, { createContext, useContext, useMemo } from 'react';
import fhir from 'fhir.js';

// Define the context type
export interface FhirContextType {
  client: any; // Actual FHIR.js client type
  config: FhirConfig;
}

// Configuration options
export interface FhirConfig {
  baseUrl: string;
  adapter: any;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
  credentials?: 'include' | 'omit' | 'same-origin';
}

// Create context with default value
export const FhirContext = createContext<FhirContextType | null>(null);

// Provider component props
interface FhirProviderProps {
  config: FhirConfig;
  children: React.ReactNode;
}

export const FhirProvider: React.FC<FhirProviderProps> = ({ config, children }) => {
  // Create memoized client instance
  const client = useMemo(() => {
    return fhir({
      baseUrl: config.baseUrl,
      timeout: config.timeout,
      retries: config.retries,
      headers: config.headers
    }, config.adapter);
  }, [config]);

  // Create context value
  const contextValue = useMemo(() => ({ client, config }), [client, config]);

  return (
    <FhirContext.Provider value={contextValue}>
      {children}
    </FhirContext.Provider>
  );
};
```

### useFhirContext Hook

```typescript
// src/hooks/useFhirContext.ts
import { useContext } from 'react';
import { FhirContext, FhirContextType } from '../components/FhirProvider';

export const useFhirContext = (): FhirContextType => {
  const context = useContext(FhirContext);
  
  if (!context) {
    throw new Error('useFhirContext must be used within a FhirProvider');
  }
  
  return context;
};
```

### useFhirSearch Hook

```typescript
// src/hooks/useFhirSearch.ts
import { useState, useEffect, useCallback } from 'react';
import { useFhirContext } from './useFhirContext';

interface SearchOptions {
  type: string;
  query?: Record<string, string | string[]>;
  pageSize?: number;
  count?: number;
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

interface SearchResult<T = any> {
  data: T | null;
  loading: boolean;
  error: any;
  refresh: () => void;
  nextPage: () => void;
  prevPage: () => void;
  hasMore: boolean;
}

export const useFhirSearch = <T = any>(options: SearchOptions): SearchResult<T> => {
  const { client } = useFhirContext();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<any>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [url, setUrl] = useState<string | null>(null);
  
  const performSearch = useCallback(async (searchUrl?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const params = {
        type: options.type,
        query: options.query || {},
        count: options.count || options.pageSize,
        url: searchUrl
      };
      
      const response = await (searchUrl ? client.nextPage({ url: searchUrl }) : client.search(params));
      
      setData(response.data);
      setHasMore(!!response.data.link?.find((link: any) => link.relation === 'next'));
      setUrl(response.data.link?.find((link: any) => link.relation === 'next')?.url || null);
      
      if (options.onSuccess) {
        options.onSuccess(response.data);
      }
    } catch (err) {
      setError(err);
      if (options.onError) {
        options.onError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [client, options]);
  
  useEffect(() => {
    performSearch();
  }, [performSearch]);
  
  const refresh = useCallback(() => performSearch(), [performSearch]);
  
  const nextPage = useCallback(() => {
    if (url) {
      performSearch(url);
    }
  }, [url, performSearch]);
  
  const prevPage = useCallback(() => {
    if (data && data.link) {
      const prevLink = data.link.find((link: any) => link.relation === 'previous');
      if (prevLink && prevLink.url) {
        performSearch(prevLink.url);
      }
    }
  }, [data, performSearch]);
  
  return { data, loading, error, refresh, nextPage, prevPage, hasMore };
};
```

## Dependencies

This implementation will have the following dependencies:

- `react` (peer dependency, ^16.8.0 or ^17.0.0 or ^18.0.0)
- `react-dom` (peer dependency, matching React version)
- `fhir.js` (the core library)

## Build and Publishing

The package will be built using TypeScript and bundled with Rollup to support:

- ES modules for modern bundlers
- CommonJS for Node.js environments
- UMD for direct browser usage

## Testing Strategy

Tests will be written using Jest and React Testing Library to ensure:

- Components render correctly
- Hooks manage state and side effects properly
- Error cases are handled appropriately
- Integration with the FHIR.js library works as expected

## Documentation

Documentation will include:

- API reference for all hooks and components
- Example usage for common scenarios
- Migration guides from direct FHIR.js usage
- TypeScript type definitions

## Timeline

1. Core components and hooks implementation (1 week)
2. Testing and validation with FHIR servers (1 week)
3. Documentation and examples (3 days)
4. Review and refinement (2 days)
5. Publication to npm (1 day)
