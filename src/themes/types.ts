/**
 * Theme Types
 */

export interface Theme {
  name: string;
  displayName: string;
  primaryColor: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
}

export interface ThemeConfig {
  themes: Record<string, Theme>;
  defaultTheme: string;
}
