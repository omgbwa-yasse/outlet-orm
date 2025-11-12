# Hidden Attributes Feature Implementation Summary

## Overview
Successfully implemented `withHidden()` and `withoutHidden()` methods for the outlet-orm package, allowing developers to control the visibility of hidden attributes in query results.

## What Was Implemented

### 1. Core Functionality

#### New Methods in `Model` Class
- **`static withHidden()`**: Returns a QueryBuilder that includes hidden attributes in results
- **`static withoutHidden(show = false)`**: Returns a QueryBuilder with controlled visibility
  - `show = false` (default): Hidden attributes are masked
  - `show = true`: Hidden attributes are visible

### 2. Files Modified

#### `src/Model.js`
- Added `_showHidden` property to constructor (initialized to `false`)
- Added `withHidden()` static method
- Added `withoutHidden(show)` static method
- Modified `toJSON()` to respect `_showHidden` flag

#### `src/QueryBuilder.js`
- Added `_showHidden` property to constructor (initialized to `false`)
- Modified `hydrate()` to transfer visibility flag to model instances

#### `types/index.d.ts`
- Added TypeScript definitions for `withHidden()` and `withoutHidden()`

#### `README.md`
- Added feature to key features list
- Added comprehensive usage examples in "Attributs cachés" section
- Added methods to API reference

### 3. Tests Created

#### `tests/Model.test.js`
- Added tests for hidden attributes in `toJSON()`
- Added tests for `_showHidden` flag behavior

#### `tests/WithHidden.test.js` (New file)
- 10 comprehensive test cases covering:
  - `withHidden()` functionality
  - `withoutHidden()` with boolean parameter
  - Default hiding behavior
  - Real-world authentication scenarios
  - API response scenarios
  - Query chaining compatibility

#### `examples/hidden-attributes-demo.js` (New file)
- Complete working example demonstrating all use cases

## Test Results

All 56 tests pass successfully:
- 46 existing tests (unchanged)
- 10 new tests for hidden attributes feature

## Usage Examples

### Basic Usage

```javascript
class User extends Model {
  static hidden = ['password', 'api_token'];
}

// Default: hidden attributes are masked
const users = await User.all();
console.log(users[0].toJSON()); // password is hidden

// Include hidden attributes
const userWithPassword = await User.withHidden()
  .where('email', 'john@example.com')
  .first();
console.log(userWithPassword.toJSON()); // password is visible

// Alternative syntax
const user = await User.withoutHidden(true).first(); // show hidden
const user2 = await User.withoutHidden(false).first(); // hide (default)
```

### Authentication Use Case

```javascript
// Fetch user with password for authentication
const user = await User.withHidden()
  .where('email', email)
  .first();

if (user && await bcrypt.compare(password, user.getAttribute('password'))) {
  // Authentication successful
}
```

### API Response Use Case

```javascript
// Safe API response without sensitive data
const users = await User.all();
res.json(users.map(u => u.toJSON())); // passwords hidden by default
```

## Implementation Details

### Architecture
1. **QueryBuilder Level**: The `_showHidden` flag is set on the QueryBuilder instance
2. **Model Hydration**: When creating model instances from database rows, the flag is transferred
3. **Serialization**: The `toJSON()` method checks the flag before filtering hidden attributes

### Backward Compatibility
- ✅ Fully backward compatible
- ✅ Default behavior unchanged (hidden attributes remain hidden)
- ✅ All existing tests pass without modification

## Benefits

1. **Security**: Developers can easily prevent sensitive data from being exposed
2. **Flexibility**: Simple API to control visibility when needed (e.g., authentication)
3. **Laravel-Like**: Familiar API for developers coming from Laravel/Eloquent
4. **Type-Safe**: Full TypeScript support included
5. **Well-Tested**: Comprehensive test coverage with real-world scenarios

## Documentation

- ✅ README.md updated with examples
- ✅ API reference updated
- ✅ TypeScript definitions added
- ✅ Working demo file created
- ✅ Inline code documentation (JSDoc)

## Verification

Run the following to verify:

```bash
# Run all tests
npm test

# Run specific tests
npm test -- WithHidden.test.js

# Run demo
node examples/hidden-attributes-demo.js
```

## Conclusion

The implementation is complete, well-tested, and production-ready. The feature follows Laravel Eloquent's pattern and integrates seamlessly with the existing outlet-orm architecture.
