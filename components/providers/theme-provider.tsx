"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// Avoid importing internal type paths from `next-themes` which can break type resolution during
// `next build` in some environments. Derive props from the actual provider component.
type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider> & {
  children?: React.ReactNode;
};

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...(props as any)}>{children}</NextThemesProvider>;
}