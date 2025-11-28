# Storybook Component Library

Storybook provides an interactive visual component library for the Upkeep property management system's Vue 3 frontend.

## Overview

Storybook allows you to:
- Browse all UI components in isolation
- Test components with different props and states
- View responsive layouts at different breakpoints
- Document component APIs with interactive controls
- Verify design system consistency (Tailwind CSS)

## Running Storybook

From the project root:

```bash
npm run storybook
```

Or from the frontend directory:

```bash
cd apps/frontend
npm run storybook
```

Storybook will start at **http://localhost:6006/**

## Building Storybook

To build a static version of Storybook for deployment:

```bash
cd apps/frontend
npm run build-storybook
```

The static build will be created in `apps/frontend/storybook-static/`

## Available Stories

### Components (Reusable)

**FormInput** (`components/FormInput.stories.ts`)
- VeeValidate-integrated form input component
- Stories: Default, Required, Password, WithoutLabel, Number, Telephone, URL
- Features: Error states, validation, different input types
- **Status**: ✅ Fully functional

**PropertyCard** (`components/PropertyCard.stories.ts`)
- Property display card with lease status
- Stories: ActiveLease, MonthToMonth, Vacant, LeaseEnded, Voided, WithoutNickname, WithoutPurchaseInfo, ExpensiveProperty
- Features: Status badges, purchase info, address display
- **Status**: ✅ Fully functional

**AppHeader** (`components/AppHeader.stories.ts`)
- Application navigation header with authentication state
- Stories: Authenticated, Unauthenticated, MobileMenuOpen, MobileMenuClosed, LongUserName
- Features: Responsive mobile menu, user menu, navigation links
- **Mocking**: Demonstrates Pinia store mocking with auth store
- **Status**: ✅ Fully functional

### Components Not Included

Some components depend on complex dependencies that would require extensive mocking infrastructure:

- **View components** (PropertyFormView, LeaseFormView, etc.) - Depend on multiple Pinia stores, router, form context, and API calls

These components work perfectly in the actual application but are better tested through E2E tests rather than isolated in Storybook

## Creating New Stories

Stories are co-located with their components using the naming convention `ComponentName.stories.ts`:

```typescript
import type { Meta, StoryObj } from '@storybook/vue3';
import YourComponent from './YourComponent.vue';

const meta = {
  title: 'Components/YourComponent',  // Category/Name in sidebar
  component: YourComponent,
  tags: ['autodocs'],  // Enables auto-generated documentation
  argTypes: {
    propName: { control: 'text' },  // Interactive controls
  },
} as Meta<typeof YourComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    propName: 'default value',
  },
};

export const Alternative: Story = {
  args: {
    propName: 'alternative value',
  },
};
```

### Best Practices

1. **Co-locate stories** - Place `.stories.ts` files next to component `.vue` files
2. **Multiple variants** - Create stories for different states (empty, filled, error, loading)
3. **Meaningful names** - Use descriptive story names (e.g., `ActiveLease`, `WithError`)
4. **Controls** - Add `argTypes` for interactive prop editing
5. **Documentation** - Use `autodocs` tag and add descriptions
6. **Mocks** - Mock external dependencies (router, stores, API calls)

## Mocking Pinia Stores and Composables

When a component depends on Pinia stores or Vue composables, you need to provide mock implementations in your stories. The AppHeader story demonstrates the recommended pattern.

### Strategy: Fresh Pinia Instance per Story

Create a new Pinia instance in each story decorator to avoid state pollution between stories:

```typescript
import { createPinia } from 'pinia';
import { useAuthStore } from '@/stores/auth';

decorators: [
  (story: any, context: any) => ({
    components: { story },
    setup() {
      // Create fresh Pinia instance
      const pinia = createPinia();

      // Get store and populate with mock data
      const authStore = useAuthStore(pinia);

      if (context.args.isAuthenticated) {
        authStore.user = {
          id: 'mock-user-id',
          name: context.args.userName || 'John Doe',
          email: 'john@example.com',
        };
        authStore.token = 'mock-jwt-token';
      }

      return { pinia };
    },
    template: '<story />',
  }),
],
```

### Global Router and Toast Mocks

Vue Router and Vue Toastification are set up globally in `apps/frontend/.storybook/preview.ts`:

```typescript
import { createMemoryHistory, createRouter } from 'vue-router';
import Toast from 'vue-toastification';

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div>Home</div>' } },
    { path: '/dashboard', component: { template: '<div>Dashboard</div>' } },
    // ... other routes
  ],
});

setup((app) => {
  app.use(router);
  app.use(Toast);
});
```

This ensures that:
- `useRouter()` composable works in all stories
- `useToast()` composable works in all stories
- `RouterLink` components render properly

### Interactive Controls for Mock Data

Make your mock data controllable via Storybook's Controls panel:

```typescript
argTypes: {
  isAuthenticated: {
    control: 'boolean',
    description: 'Whether the user is authenticated',
  },
  userName: {
    control: 'text',
    description: 'Name of the authenticated user',
  },
},
```

Then use `context.args` in your decorator to read these values and configure the mock store accordingly.

### Testing Multiple States

Create story variants for different store states:

```typescript
export const Authenticated: Story = {
  args: { isAuthenticated: true, userName: 'John Doe' },
};

export const Unauthenticated: Story = {
  args: { isAuthenticated: false },
};

export const LongUserName: Story = {
  args: {
    isAuthenticated: true,
    userName: 'Christopher Alexander Montgomery III'
  },
};
```

### When to Mock vs. When to Skip

**✅ Mock when:**
- The component has a single store dependency (like AppHeader with auth store)
- You want to showcase different component states
- The component is reusable across the application
- Mock setup is straightforward

**❌ Skip Storybook when:**
- Component depends on multiple complex stores
- Heavy API integration that's difficult to mock
- View components that orchestrate many child components
- Better covered by E2E tests (Playwright)

### Example: AppHeader Story

See `apps/frontend/src/components/AppHeader.stories.ts` for a complete working example of:
- Pinia store mocking with fresh instances
- Interactive controls for mock data
- Multiple story variants (authenticated, unauthenticated, mobile)
- Global router and toast setup

## Configuration

### Global Setup (preview.ts)

Storybook's global configuration in `apps/frontend/.storybook/preview.ts` includes:

**Tailwind CSS Integration:**
```typescript
import '../src/assets/styles/main.css';
```
All custom Tailwind classes (primary, secondary-1, secondary-2, complement colors) and fonts (Montserrat, Lato) are available in stories.

**Vue Router Mock:**
```typescript
import { createMemoryHistory, createRouter } from 'vue-router';

const router = createRouter({
  history: createMemoryHistory(),
  routes: [/* mock routes */],
});

setup((app) => {
  app.use(router);
});
```
Enables `useRouter()` composable and `RouterLink` components in all stories.

**Vue Toastification:**
```typescript
import Toast from 'vue-toastification';
import 'vue-toastification/dist/index.css';

setup((app) => {
  app.use(Toast, { /* config */ });
});
```
Enables `useToast()` composable for toast notifications in stories.

### TypeScript Path Aliases

Configured in `apps/frontend/.storybook/main.ts` to match the frontend app:

```typescript
viteFinal: async (config) => {
  return mergeConfig(config, {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '../src'),
        '@domain': path.resolve(__dirname, '../../../libs/domain/src'),
        '@validators': path.resolve(__dirname, '../../../libs/validators/src'),
        '@auth': path.resolve(__dirname, '../../../libs/auth/src'),
      },
    },
  });
},
```

## Viewport Testing

Storybook includes responsive design testing. Click the viewport icon in the toolbar to test:
- Mobile (375px)
- Tablet (768px)
- Desktop (1024px+)

Our two-column form layouts automatically switch to single-column below 1024px (lg breakpoint).

## Accessibility Testing

The `@storybook/addon-a11y` addon is enabled. Click the "Accessibility" tab to:
- Check WCAG compliance
- Identify contrast issues
- Verify keyboard navigation
- Test screen reader compatibility

## Troubleshooting

### Version Compatibility Warnings

If you see warnings about package version mismatches, they can generally be ignored. The core functionality works despite version differences between Storybook core and addons.

### Stories Not Showing

Verify the story file:
1. Is in the `src/` directory
2. Matches the pattern `**/*.stories.@(js|jsx|mjs|ts|tsx)`
3. Has a default export with `Meta` configuration
4. Has at least one exported story

### Hot Reload Not Working

Restart Storybook if HMR (Hot Module Replacement) stops working:
```bash
# Kill the process
Ctrl+C

# Restart
npm run storybook
```

### Build Failures

If TypeScript errors occur:
1. Check that all imported types are available
2. Ensure mock data matches TypeScript interfaces
3. Verify path aliases are correctly configured

## Resources

- [Storybook for Vue Documentation](https://storybook.js.org/docs/vue/get-started/introduction)
- [Writing Stories](https://storybook.js.org/docs/vue/writing-stories/introduction)
- [Essential Addons](https://storybook.js.org/docs/vue/essentials/introduction)
- [Accessibility Testing](https://storybook.js.org/docs/vue/writing-tests/accessibility-testing)
