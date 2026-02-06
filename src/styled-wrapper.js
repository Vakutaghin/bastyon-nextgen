import styled from '../node_modules/vue3-styled-components/dist/vue-styled-components.es.js';

/**
 * Wrapper for vue3-styled-components to support .withConfig() method
 * injected by babel-plugin-styled-components.
 *
 * This allows us to use:
 * 1. Stable class names (componentId)
 * 2. Debug attributes (data-styled-name)
 */

const wrapTagFunc = (tagFunc) => {
  const wrapped = (...args) => tagFunc(...args);

  // Add .withConfig support
  wrapped.withConfig = (config) => {
    return (...args) => {
      // Create the original component
      const component = tagFunc(...args);

      // If config is present, we wrap the setup function to inject attributes
      if (config && (config.displayName || config.componentId)) {
        // Set component name for better DevTools experience
        if (config.displayName) {
          component.name = config.displayName;
        }

        const originalSetup = component.setup;
        component.setup = (props, ctx) => {
          // Call original setup to get the render function
          const render = originalSetup(props, ctx);

          return () => {
            const vnode = render();

            // Ensure props object exists
            vnode.props = vnode.props || {};

            // Inject data-styled-name for debugging
            if (config.displayName) {
              vnode.props['data-styled-name'] = config.displayName;
            }

            // Inject stable componentId as a class
            // This ensures stability across builds/HMR even if internal hash changes
            if (config.componentId) {
              const existingClass = vnode.props.class || '';
              // Avoid duplicates
              if (!existingClass.includes(config.componentId)) {
                vnode.props.class = existingClass
                  ? `${existingClass} ${config.componentId}`
                  : config.componentId;
              }
            }

            return vnode;
          };
        };
      }

      return component;
    };
  };

  return wrapped;
};

const proxyHandler = {
  get(target, prop) {
    const val = target[prop];
    // Wrap styled.div, styled.span, etc.
    if (typeof val === 'function' && !val.withConfig) {
      return wrapTagFunc(val);
    }
    return val;
  },
  apply(target, thisArg, args) {
    // Handle styled('div') calls
    const val = target.apply(thisArg, args);
    return wrapTagFunc(val);
  }
};

const styledProxy = new Proxy(styled, proxyHandler);

// Re-export everything from original library
export * from '../node_modules/vue3-styled-components/dist/vue-styled-components.es.js';
export default styledProxy;
