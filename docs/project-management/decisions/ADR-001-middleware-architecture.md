# ADR-001: Middleware-Based Architecture

## Status

Accepted

## Context

The FHIR.js library needs to handle various aspects of FHIR resource interaction, including:

1. HTTP request/response handling
2. Authentication and authorization
3. Error handling and retries
4. Caching and performance optimization
5. Bundle handling and reference resolution
6. Logging and debugging

These concerns need to be modular, composable, and configurable to accommodate different use cases and environments.

## Decision

We have decided to adopt a middleware-based architecture pattern for the FHIR.js library. This pattern allows for:

1. A pipeline of middleware functions that process requests and responses
2. Each middleware focusing on a specific concern
3. Configurable middleware stacks for different usage scenarios
4. Custom middleware creation by library users

The middleware pattern will follow a similar approach to Express.js middleware, where each function can:

- Process the incoming request
- Call the next middleware in the chain
- Process the outgoing response
- Handle errors from downstream middleware

## Consequences

### Positive Consequences

- Separation of concerns makes the codebase more maintainable
- Users can customize the library behavior by adding, removing, or reordering middleware
- Testing is simplified as each middleware can be tested in isolation
- New features can be added without modifying existing code
- Different adapters can reuse the same middleware

### Negative Consequences

- More complex architecture for simple use cases
- Potential performance overhead from the middleware chain
- Learning curve for users who want to create custom middleware
- Debugging can be more complex when errors occur in the middleware chain

## Alternatives Considered

1. **Monolithic approach**: Having a single module handle all concerns.
   - Rejected due to poor maintainability and lack of customization options.

2. **Class inheritance model**: Using a base class with derived classes for different functionality.
   - Rejected due to inflexibility and complexities with multiple inheritance.

3. **Event-based architecture**: Using an event emitter/listener pattern.
   - Rejected due to difficulty in maintaining flow control and order of operations.

## References

- [Express.js Middleware](https://expressjs.com/en/guide/using-middleware.html)
- [Redux Middleware](https://redux.js.org/understanding/history-and-design/middleware)
- [Middleware Pattern](https://en.wikipedia.org/wiki/Middleware_(distributed_applications))
