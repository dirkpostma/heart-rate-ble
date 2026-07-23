// Local CSF type shim so `.stories.tsx` files can be authored and typecheck
// *before* PR 3 (#88) installs `@storybook/react-native`. Storybook's Component
// Story Format is just a default-exported `meta` object plus named story
// exports — plain data, no runtime dependency. These minimal types capture that
// shape so stories are inert (nothing renders them yet) but compile clean under
// `tsc`. When #88 lands the harness, stories can keep importing from here or be
// re-pointed at `@storybook/react-native`; either way the CSF objects are valid.
import type { ComponentProps, ComponentType, ReactElement } from 'react';

export type Meta<C extends ComponentType<any>> = {
  title?: string;
  component: C;
  args?: Partial<ComponentProps<C>>;
  argTypes?: Record<string, unknown>;
  decorators?: Array<(story: () => ReactElement) => ReactElement>;
};

export type StoryObj<C extends ComponentType<any>> = {
  args?: Partial<ComponentProps<C>>;
  name?: string;
  render?: (args: ComponentProps<C>) => ReactElement;
};
