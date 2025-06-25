# ENH-001: React/Vue Component Wrappers - Updates

This document tracks ongoing updates and discussions related to the ENH-001 enhancement request.

## Update Log

### 2025-06-25

Initial research conducted on existing React and Vue wrappers for API libraries similar to FHIR.js:

1. Found popular patterns:
   - React Query / TanStack Query for data fetching
   - SWR (stale-while-revalidate) pattern
   - Vue Composition API with `provide`/`inject`

2. Community preferences:
   - Strong preference for hooks-based API in React
   - Composition API preferred over Options API in Vue
   - TypeScript support critical for both frameworks

3. Technical considerations:
   - Package size concerns (bundle splitting)
   - Tree-shaking support
   - Server-side rendering compatibility
   - React Server Components compatibility

## Prototype Implementation

Created basic prototype implementation of React hooks:

```jsx
// useFhirSearch hook
export function useFhirSearch(options) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const client = useFhirContext();
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const result = await client.search(options);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [JSON.stringify(options)]);
  
  const refetch = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await client.search(options);
      setData(result);
      setError(null);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [JSON.stringify(options)]);
  
  return { data, error, isLoading, refetch };
}
```

## Community Feedback

Initial feedback from community contributors:

1. Strong preference for integrating with existing data fetching libraries:
   - TanStack Query (React Query) for React
   - VueUse for Vue

2. Specific feature requests:
   - Real-time updates via WebSockets
   - Offline support with IndexedDB
   - Selective updates of large resources
   - Form state integration

## Next Steps

1. Create proof-of-concept implementations for:
   - React integration with TanStack Query
   - Vue integration with VueUse

2. Evaluate trade-offs between:
   - Standalone implementations vs. integration with existing libraries
   - Bundle size vs. feature completeness
   - Ease of use vs. flexibility

3. Develop comprehensive TypeScript types for component props and return values

4. Create example applications demonstrating integration patterns
