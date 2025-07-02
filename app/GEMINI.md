# Gemini Frontend Configuration

This file provides project-specific context and instructions for the frontend application built with React Router v7.

## Frontend Architecture

The frontend implements a modern Server-Side Rendering (SSR) architecture with React Router v7, featuring file-based routing and advanced middleware patterns.

### Core Architecture Components

- **`root.tsx`**: Root application component with layout and global providers
- **`entry.server.tsx`**: Server-side entry point for SSR with Cloudflare Workers integration
- **`routes.ts`**: Route configuration with type-safe routing
- **`routes/`**: File-based route components with @react-router/fs-routes support

### File-Based Routing (`app/routes/`)

The application uses @react-router/fs-routes for automatic route generation:

- **Nested Routing:** Folder-based route organization with layout inheritance
- **Dynamic Routes:** Parameter-based routing with type-safe route parameters
- **Route Handlers:** Loader and action functions for data fetching and mutations
- **Middleware Integration:** Authentication and authorization middleware at route level

### Middleware Architecture (`app/middleware/`)

- **Authentication Middleware:** Cloudflare Access JWT verification
- **Authorization Middleware:** RBAC permission checks
- **Logging Middleware:** Request tracing and audit logging
- **Error Handling:** Global error boundary and fallback components

## Key Technologies & Libraries

### Core Framework
- **React 18:** Modern React with concurrent features and SSR
- **React Router v7:** Advanced routing with SSR, loaders, actions, and middleware
- **@react-router/fs-routes:** Automatic route generation from file system
- **TypeScript:** Full type safety across frontend and backend

### Styling & UI
- **TailwindCSS v4:** Utility-first CSS framework with JIT compilation
- **CSS Modules:** Component-scoped styling when needed
- **Design System:** Consistent component library and design tokens

### State Management
- **React Router State:** URL-driven state management
- **React Context:** Global application state and user context
- **Server State:** Loader-based data fetching with automatic revalidation

### Build & Development Tools
- **Vite:** Fast build tool with HMR and React Router plugin
- **TypeScript:** Static type checking and IntelliSense
- **Biome:** Fast linting and formatting (35x faster than Prettier)

### Integration & Communication
- **Server Functions:** Direct backend integration through React Router actions
- **Cloudflare Workers:** Edge runtime with global distribution
- **Progressive Enhancement:** Works with and without JavaScript

## Development Patterns

### Component Architecture
- **Server Components:** SSR-optimized components for better performance
- **Client Components:** Interactive components with hydration
- **Layout Components:** Shared layouts with outlet-based composition
- **Route Components:** Page-level components with data loading

### Data Fetching Patterns
- **Loaders:** Server-side data fetching with automatic caching
- **Actions:** Form submissions and mutations with type safety
- **Revalidation:** Automatic data updates on navigation and form submission
- **Error Boundaries:** Graceful error handling with fallback UI

### Authentication & Authorization
- **Route Protection:** Middleware-based route protection
- **User Context:** Global user state with RBAC permissions
- **Conditional Rendering:** Permission-based UI components
- **Secure Redirects:** Automatic redirects for unauthorized access

### Performance Optimization
- **Code Splitting:** Automatic route-based code splitting
- **Lazy Loading:** On-demand component and resource loading
- **Edge SSR:** Server-side rendering at Cloudflare's edge locations
- **Caching Strategy:** Efficient caching with Cloudflare CDN

## Route Organization

### Public Routes
- **`/`**: Landing page with public content
- **`/blog`**: Public blog listing and article pages
- **`/about`**: Public information pages

### Protected Routes (`/admin/*`)
- **`/admin/dashboard`**: Admin dashboard with analytics
- **`/admin/content`**: Content management interface
- **`/admin/media`**: Media management and upload
- **`/admin/users`**: User management (admin only)
- **`/admin/settings`**: System configuration

### API Routes (`/api/*`)
- **`/api/content`**: Content CRUD operations
- **`/api/media`**: Media upload and management
- **`/api/auth`**: Authentication endpoints

## Security Implementation

### Client-Side Security
- **Input Validation:** Zod schema validation for all forms
- **XSS Protection:** Proper output encoding and CSP headers
- **CSRF Protection:** Form tokens and same-origin validation
- **Content Security Policy:** Strict CSP headers for script execution

### Authentication Flow
1. **Cloudflare Access:** Edge-level authentication
2. **Middleware Verification:** Server-side JWT verification
3. **User Context Loading:** RBAC permission loading
4. **Route Protection:** Permission-based access control

### Authorization Patterns
- **Permission Guards:** Route-level permission checks
- **Conditional UI:** Role-based component rendering
- **API Security:** Backend permission validation
- **Audit Logging:** User action tracking and logging

## Development Guidelines

### Component Development
- **Functional Components:** Use React hooks and modern patterns
- **TypeScript First:** Full type safety for props and state
- **Accessibility:** WCAG 2.1 AA compliance
- **Performance:** Optimize for Core Web Vitals

### State Management
- **URL State:** Prefer URL-based state for navigation and filters
- **Local State:** Use useState for component-specific state
- **Global State:** Use React Context for cross-component state
- **Server State:** Use loaders for server-side data

### Testing Strategy
- **Unit Tests:** Component logic and utility functions
- **Integration Tests:** Route handlers and data flow
- **E2E Tests:** Critical user flows with Playwright
- **Accessibility Tests:** Screen reader and keyboard navigation

### Code Organization
- **File Naming:** PascalCase for components, camelCase for utilities
- **Import Organization:** Absolute imports with path mapping
- **Component Structure:** Consistent component file organization
- **Type Definitions:** Co-located TypeScript interfaces

## Performance Considerations

### Build Optimization
- **Bundle Splitting:** Route-based and vendor chunking
- **Tree Shaking:** Dead code elimination
- **Asset Optimization:** Image and font optimization
- **Compression:** Gzip and Brotli compression

### Runtime Performance
- **React Optimization:** useMemo, useCallback for expensive operations
- **Virtual Scrolling:** Large list optimization
- **Image Optimization:** Lazy loading and responsive images
- **Caching Strategy:** Browser and CDN caching

### Core Web Vitals
- **Largest Contentful Paint (LCP):** < 2.5s target
- **First Input Delay (FID):** < 100ms target
- **Cumulative Layout Shift (CLS):** < 0.1 target

## Related Documentation

For comprehensive implementation details, refer to:
- [React Router Middleware Patterns](../docs/implementation/react-router-middleware-patterns.md) - Middleware implementation
- [Authentication Security](../docs/architecture/authentication-security.md) - Security architecture
- [RBAC Domain Model](../docs/architecture/rbac-domain-model.md) - Authorization patterns
- [Development Guide](../docs/implementation/development-guide.md) - Development workflows
- [Testing Strategy](../docs/implementation/testing-strategy.md) - Frontend testing approaches
- [Routing Design](../docs/architecture/routing-design.md) - Complete routing architecture