# Dependency Injection Container

Coop uses [BottleJS](https://github.com/young-steveo/bottlejs) for dependency injection.

## Why Dependency Injection?

- Enables mocking services in tests (required for ESM modules)  
- Supports runtime injection based on environment or feature flags  
- Makes dependencies explicit in the source code

## How It Works

Services are registered by name in the container. Each name acts as an interface that can have different implementations:

```ts
// Register a service
bottle.service('MyService', MyServiceImpl);

// Inject into a class
class ActionAPI {
  constructor(private readonly myService: Dependencies['MyService']) {}
}

export default inject(['MyService'], ActionAPI);
```

## Why BottleJS?

BottleJS was chosen over alternatives like Inversify because it supports injecting functions and scalar values, not just class instances.